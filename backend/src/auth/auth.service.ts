import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppErrors } from '../common/errors/app-error';
import { hashOtp, hashPassword, verifyPassword } from '../common/auth/password.util';
import { RequestUser } from '../common/auth/request-user';

const OTP_TTL_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const OTP_REQUEST_COOLDOWN_SECONDS = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async requestOtp(mobileNumber: string) {
    // Throttle: reject a new OTP request within OTP_REQUEST_COOLDOWN_SECONDS of the
    // last one for this number. Prevents an attacker from rapid-firing OTP requests
    // to burn SMS budget or use delivery timing/volume to enumerate valid numbers.
    const lastChallenge = await this.prisma.otpChallenge.findFirst({
      where: { mobileNumber },
      orderBy: { createdAt: 'desc' },
    });
    if (lastChallenge) {
      const secondsSinceLast = (Date.now() - lastChallenge.createdAt.getTime()) / 1000;
      if (secondsSinceLast < OTP_REQUEST_COOLDOWN_SECONDS) {
        throw AppErrors.badRequest(
          'OTP_REQUEST_TOO_SOON',
          `Please wait ${Math.ceil(OTP_REQUEST_COOLDOWN_SECONDS - secondsSinceLast)}s before requesting another OTP`,
        );
      }
    }

    const isDev = process.env.NODE_ENV !== 'production';
    const otp = isDev && process.env.OTP_STATIC_DEV_CODE ? process.env.OTP_STATIC_DEV_CODE : this.generateOtp();

    await this.prisma.otpChallenge.create({
      data: {
        mobileNumber,
        otpHash: hashOtp(otp),
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      },
    });

    // Real delivery is a pluggable SMS provider (MSG91/Twilio Verify per the stack
    // recommendation) — not wired up here since it needs a real account/API key.
    this.logger.log(`OTP for ${mobileNumber}: ${isDev ? otp : '******'} (SMS delivery not yet integrated)`);

    return { message: 'OTP sent', ...(isDev ? { devOtp: otp } : {}) };
  }

  async verifyOtp(mobileNumber: string, otp: string) {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { mobileNumber, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge || challenge.expiresAt < new Date()) {
      throw AppErrors.badRequest('OTP_EXPIRED_OR_NOT_FOUND', 'OTP has expired or was never requested');
    }
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      throw AppErrors.badRequest('OTP_ATTEMPTS_EXCEEDED', 'Too many incorrect attempts — request a new OTP');
    }
    if (challenge.otpHash !== hashOtp(otp)) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw AppErrors.badRequest('INVALID_OTP', 'Incorrect OTP');
    }

    await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });

    return this.prisma.withLoginLookup(async (tx) => {
      const user = await tx.user.findUnique({ where: { mobileNumber }, include: { role: true } });
      if (!user) {
        throw AppErrors.notFound('USER_NOT_FOUND', 'No account found for this mobile number');
      }
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      return this.issueTokens(user, user.role.name);
    });
  }

  async login(email: string, password: string) {
    return this.prisma.withLoginLookup(async (tx) => {
      const user = await tx.user.findFirst({ where: { email }, include: { role: true } });
      if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        throw AppErrors.badRequest('INVALID_CREDENTIALS', 'Incorrect email or password');
      }
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      return this.issueTokens(user, user.role.name);
    });
  }

  async refresh(refreshToken: string) {
    let payload: RequestUser & { type: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    } catch {
      throw AppErrors.badRequest('INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired', undefined);
    }
    if (payload.type !== 'refresh') {
      throw AppErrors.badRequest('INVALID_REFRESH_TOKEN', 'Not a refresh token');
    }
    const accessToken = await this.signAccessToken(payload);
    return { accessToken };
  }

  hashPasswordForSeed(plain: string) {
    return hashPassword(plain);
  }

  private generateOtp(): string {
    return String(Math.floor(10000 + Math.random() * 90000));
  }

  private async issueTokens(
    user: { id: string; tenantId: string | null; roleId: string; employeeId: string | null },
    roleName: string,
  ) {
    const basePayload: RequestUser = {
      userId: user.id,
      tenantId: user.tenantId,
      roleId: user.roleId,
      roleName,
      employeeId: user.employeeId,
    };
    const accessToken = await this.signAccessToken(basePayload);
    const refreshToken = await this.jwt.signAsync(
      { ...basePayload, type: 'refresh' },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: process.env.JWT_REFRESH_EXPIRY ?? '30d' },
    );
    return { accessToken, refreshToken, user: basePayload };
  }

  private signAccessToken(payload: RequestUser) {
    return this.jwt.signAsync(
      { ...payload, type: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: process.env.JWT_ACCESS_EXPIRY ?? '15m' },
    );
  }
}
