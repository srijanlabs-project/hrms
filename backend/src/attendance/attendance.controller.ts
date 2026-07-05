import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { PunchDto } from './dto/punch.dto';
import { SubmitRegularizationDto } from './dto/regularization.dto';
import { BiometricWebhookDto } from './dto/biometric-webhook.dto';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/request-user';
import { Public } from '../common/auth/public.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { verifyPassword } from '../common/auth/password.util';
import { Roles } from '../common/auth/roles.decorator';
import { SystemRole } from '../common/auth/roles.enum';
import { DecisionDto } from '../approvals/dto/decision.dto';

@Controller('api/v1')
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('attendance/punch')
  punch(@CurrentUser() user: RequestUser, @Body() dto: PunchDto) {
    return this.attendance.punch(user.tenantId!, user.employeeId!, dto);
  }

  @Get('attendance')
  list(
    @CurrentUser() user: RequestUser,
    @Query('employeeId') employeeId: string | undefined,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.attendance.list(user.tenantId!, { employeeId: employeeId ?? user.employeeId!, from, to });
  }

  @Post('attendance/regularization')
  submitRegularization(@CurrentUser() user: RequestUser, @Body() dto: SubmitRegularizationDto) {
    return this.attendance.submitRegularization(user.tenantId!, user.employeeId!, dto);
  }

  @Patch('attendance/regularization/:id/decision')
  decideRegularization(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.attendance.decideRegularization(user.tenantId!, id, user, dto.decision, dto.comment);
  }

  @Get('shift-policies')
  listShiftPolicies(@CurrentUser() user: RequestUser) {
    return this.attendance.listShiftPolicies(user.tenantId!);
  }

  @Roles(SystemRole.HR_ADMIN)
  @Post('shift-policies')
  createShiftPolicy(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.attendance.createShiftPolicy(user.tenantId!, body as never);
  }

  /**
   * Authenticated via a per-device API key, not a user JWT (spec §5.4) — the
   * device is resolved server-side to exactly one tenant, which is why this
   * route is @Public() (bypasses the JWT guard) but still cannot cross tenants.
   */
  @Public()
  @Post('integrations/biometric/events')
  async biometricWebhook(@Headers('x-device-api-key') apiKey: string, @Body() dto: BiometricWebhookDto) {
    if (!apiKey) throw new UnauthorizedException('Missing device API key');

    const device = await this.prisma.withoutTenantScope(async (tx) => {
      const candidates = await tx.biometricDevice.findMany({ where: { deviceId: dto.deviceId, isActive: true } });
      return candidates.find((d) => verifyPassword(apiKey, d.apiKeyHash));
    });
    if (!device) throw new UnauthorizedException('Invalid device API key');

    const results = [];
    for (const event of dto.events) {
      results.push(
        await this.attendance.processBiometricPunch(device.tenantId, dto.deviceId, event.deviceUserCode, event.timestamp, event.type),
      );
    }
    return { processed: results.length, unmatched: results.filter((r) => !r.matched).length };
  }
}
