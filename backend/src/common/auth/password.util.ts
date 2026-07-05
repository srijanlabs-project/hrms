import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

// Node's built-in scrypt — deliberately avoids adding bcrypt as a native-compiled
// dependency (this dev machine already has enough native-build friction).
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(plain, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function hashOtp(otp: string): string {
  return scryptSync(otp, 'hrms-otp-static-salt', 32).toString('hex');
}
