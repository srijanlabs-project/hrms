import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppErrors } from '../common/errors/app-error';
import { ApprovalsService } from '../approvals/approvals.service';
import { PunchDto } from './dto/punch.dto';
import { SubmitRegularizationDto } from './dto/regularization.dto';

type Tx = Prisma.TransactionClient;

const EARTH_RADIUS_M = 6_371_000;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function todayDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
  ) {}

  async listShiftPolicies(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) => tx.shiftPolicy.findMany({ where: { tenantId } }));
  }

  async createShiftPolicy(tenantId: string, data: Prisma.ShiftPolicyUncheckedCreateInput) {
    return this.prisma.withTenant(tenantId, (tx) => tx.shiftPolicy.create({ data: { ...data, tenantId } }));
  }

  /** Public: also used by Leave Management to exclude weekly-offs from total_days (spec §4.2). */
  async resolveShiftPolicy(tx: Tx, tenantId: string, departmentId: string | null) {
    const policies = await tx.shiftPolicy.findMany({ where: { tenantId } });
    const departmentMatch = departmentId
      ? policies.find((p) => p.applicableDepartmentIds.includes(departmentId))
      : undefined;
    const policy = departmentMatch ?? policies.find((p) => p.isDefault);
    if (!policy) {
      throw AppErrors.badRequest('NO_SHIFT_POLICY_CONFIGURED', 'No shift policy is configured for this tenant');
    }
    return policy;
  }

  async punch(tenantId: string, employeeId: string, dto: PunchDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const employee = await tx.employee.findUniqueOrThrow({ where: { id: employeeId } });
      if (employee.employmentStatus === 'exited') {
        throw AppErrors.badRequest('EMPLOYEE_NOT_ACTIVE', 'Cannot record attendance for an inactive employee');
      }

      const clientTs = new Date(dto.clientTimestamp);
      if (clientTs.getTime() > Date.now() + 60_000) {
        throw AppErrors.badRequest('FUTURE_TIMESTAMP', 'Timestamp cannot be in the future');
      }

      if (dto.source === 'gps') {
        if (dto.latitude == null || dto.longitude == null) {
          throw AppErrors.badRequest('MISSING_LOCATION', 'latitude/longitude are required for GPS punches');
        }
        const location = employee.workLocationId
          ? await tx.location.findUnique({ where: { id: employee.workLocationId } })
          : null;
        if (location?.geofenceLatitude != null && location.geofenceRadiusMeters != null) {
          const distance = haversineMeters(
            Number(location.geofenceLatitude),
            Number(location.geofenceLongitude),
            dto.latitude,
            dto.longitude,
          );
          if (distance > location.geofenceRadiusMeters) {
            throw AppErrors.unprocessable('OUTSIDE_GEOFENCE', 'You are outside the permitted check-in area');
          }
        }
      }

      const date = todayDateOnly(clientTs);
      const shiftPolicy = await this.resolveShiftPolicy(tx, tenantId, employee.departmentId);

      let record = await tx.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId, date } } });

      if (dto.type === 'check_in') {
        if (record?.checkIn && dto.source !== 'manual') {
          throw AppErrors.conflict('ALREADY_CHECKED_IN', 'You have already checked in today');
        }
        const isLate = this.computeIsLate(shiftPolicy, clientTs);
        record = await tx.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId, date } },
          create: {
            tenantId,
            employeeId,
            date,
            shiftPolicyId: shiftPolicy.id,
            checkIn: clientTs,
            checkInSource: dto.source,
            checkInLatitude: dto.latitude,
            checkInLongitude: dto.longitude,
            isLate,
            status: 'pending',
          },
          update: { checkIn: clientTs, checkInSource: dto.source, isLate },
        });
      } else {
        if (!record?.checkIn) {
          throw AppErrors.badRequest('NOT_CHECKED_IN', 'Cannot check out before checking in');
        }
        const workedMinutes = Math.max(0, Math.round((clientTs.getTime() - record.checkIn.getTime()) / 60_000));
        const status: AttendanceStatus =
          workedMinutes < shiftPolicy.halfDayThresholdMinutes ? 'half_day' : 'present';
        const overtimeMinutes = shiftPolicy.overtimeEnabled
          ? Math.max(0, workedMinutes - (this.shiftLengthMinutes(shiftPolicy) + (shiftPolicy.overtimeThresholdMinutes ?? 0)))
          : 0;
        record = await tx.attendanceRecord.update({
          where: { id: record.id },
          data: { checkOut: clientTs, workedMinutes, status, overtimeMinutes },
        });
      }

      return record;
    });
  }

  private shiftLengthMinutes(policy: { startTime: Date; endTime: Date }): number {
    const start = policy.startTime.getUTCHours() * 60 + policy.startTime.getUTCMinutes();
    const end = policy.endTime.getUTCHours() * 60 + policy.endTime.getUTCMinutes();
    return end >= start ? end - start : end + 24 * 60 - start;
  }

  private computeIsLate(policy: { startTime: Date; graceMinutes: number }, checkIn: Date): boolean {
    const shiftStartMinutes = policy.startTime.getUTCHours() * 60 + policy.startTime.getUTCMinutes();
    const checkInMinutes = checkIn.getUTCHours() * 60 + checkIn.getUTCMinutes();
    return checkInMinutes > shiftStartMinutes + policy.graceMinutes;
  }

  async list(tenantId: string, filters: { employeeId: string; from: string; to: string }) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.attendanceRecord.findMany({
        where: { tenantId, employeeId: filters.employeeId, date: { gte: new Date(filters.from), lte: new Date(filters.to) } },
        orderBy: { date: 'desc' },
      }),
    );
  }

  async submitRegularization(tenantId: string, employeeId: string, dto: SubmitRegularizationDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const record = await tx.attendanceRecord.findUnique({ where: { id: dto.attendanceRecordId } });
      if (!record) throw AppErrors.notFound('ATTENDANCE_RECORD_NOT_FOUND', 'Attendance record not found');
      if (record.isRegularized) {
        throw AppErrors.badRequest('ALREADY_REGULARIZED', 'This record has already been regularized');
      }
      const windowDays = 7;
      const ageDays = (Date.now() - record.date.getTime()) / 86_400_000;
      if (ageDays > windowDays) {
        throw AppErrors.unprocessable('WINDOW_EXPIRED', 'This attendance date is outside the correction window');
      }
      if (!dto.requestedCheckIn && !dto.requestedCheckOut) {
        throw AppErrors.badRequest('NO_CHANGE_REQUESTED', 'At least one correction field is required');
      }

      const { instance } = await this.approvals.createInstance(tx, {
        tenantId,
        applicability: 'regularization',
        subjectEmployeeId: employeeId,
      });

      return tx.regularizationRequest.create({
        data: {
          tenantId,
          attendanceRecordId: dto.attendanceRecordId,
          requestedCheckIn: dto.requestedCheckIn ? new Date(dto.requestedCheckIn) : null,
          requestedCheckOut: dto.requestedCheckOut ? new Date(dto.requestedCheckOut) : null,
          reason: dto.reason,
          approvalInstanceId: instance.id,
        },
      });
    });
  }

  async decideRegularization(
    tenantId: string,
    regularizationId: string,
    actingUser: { userId: string; employeeId: string | null; roleId: string },
    decision: 'approve' | 'reject',
    comment?: string,
  ) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const req = await tx.regularizationRequest.findUnique({ where: { id: regularizationId } });
      if (!req || !req.approvalInstanceId) {
        throw AppErrors.notFound('REGULARIZATION_NOT_FOUND', 'Regularization request not found');
      }
      const { instance } = await this.approvals.decide(tx, req.approvalInstanceId, actingUser, decision, comment);

      const newStatus = instance.status === 'approved' ? 'approved' : instance.status === 'rejected' ? 'rejected' : 'pending';
      await tx.regularizationRequest.update({ where: { id: regularizationId }, data: { status: newStatus } });

      if (instance.status === 'approved') {
        const record = await tx.attendanceRecord.findUniqueOrThrow({ where: { id: req.attendanceRecordId } });
        const shiftPolicy = await tx.shiftPolicy.findUniqueOrThrow({ where: { id: record.shiftPolicyId } });
        const checkIn = req.requestedCheckIn ?? record.checkIn;
        const checkOut = req.requestedCheckOut ?? record.checkOut;
        const workedMinutes = checkIn && checkOut ? Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60_000)) : record.workedMinutes;
        const status: AttendanceStatus = checkIn && checkOut ? (workedMinutes < shiftPolicy.halfDayThresholdMinutes ? 'half_day' : 'present') : record.status;
        await tx.attendanceRecord.update({
          where: { id: record.id },
          data: { checkIn, checkOut, workedMinutes, status, isRegularized: true },
        });
      }
      return req;
    });
  }

  /** Biometric webhook (spec §5.4) — device is pre-resolved to exactly one tenant by the controller/guard. */
  async processBiometricPunch(tenantId: string, deviceId: string, deviceUserCode: string, timestamp: string, type: 'in' | 'out') {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const device = await tx.biometricDevice.findFirst({ where: { tenantId, deviceId } });
      if (!device) return { matched: false };
      const mapping = await tx.biometricUserMapping.findFirst({ where: { biometricDeviceId: device.id, deviceUserCode } });
      if (!mapping) return { matched: false };

      await this.punch(tenantId, mapping.employeeId, {
        type: type === 'in' ? 'check_in' : 'check_out',
        source: 'biometric',
        clientTimestamp: timestamp,
      });
      return { matched: true };
    });
  }

  /** Monthly aggregate consumed directly by Payroll (spec §6, avoids Payroll re-deriving daily logic). */
  async getMonthlyAggregate(tenantId: string, employeeId: string, period: string) {
    const [year, month] = period.split('-').map(Number);
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0));
    return this.prisma.withTenant(tenantId, async (tx) => {
      const records = await tx.attendanceRecord.findMany({
        where: { tenantId, employeeId, date: { gte: from, lte: to } },
      });
      const daysInPeriod = to.getUTCDate();
      const present = records.filter((r) => r.status === 'present').length;
      const halfDay = records.filter((r) => r.status === 'half_day').length;
      const absent = records.filter((r) => r.status === 'absent').length;
      const onLeave = records.filter((r) => r.status === 'on_leave').length;
      const overtimeMinutes = records.reduce((sum, r) => sum + r.overtimeMinutes, 0);
      const lopDays = absent + halfDay * 0.5;
      return { daysInPeriod, present, halfDay, absent, onLeave, overtimeMinutes, lopDays };
    });
  }

  /** Nightly status-derivation job (spec §3 & §6) — runs once for all tenants at a fixed server time. */
  @Cron('30 0 * * *')
  async nightlyFinalization() {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const date = todayDateOnly(yesterday);

    await this.prisma.withoutTenantScope(async (tx) => {
      const employees = await tx.employee.findMany({ where: { employmentStatus: { not: 'exited' } } });
      for (const employee of employees) {
        const existing = await tx.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId: employee.id, date } } });
        if (existing && ['on_leave', 'holiday', 'week_off', 'present', 'absent', 'half_day'].includes(existing.status)) continue;

        const shiftPolicy = await this.resolveShiftPolicy(tx, employee.tenantId, employee.departmentId).catch(() => null);
        if (!shiftPolicy) continue;

        const holiday = employee.workLocationId
          ? await tx.holiday.findFirst({ where: { locationId: employee.workLocationId, date } })
          : null;
        const weekday = date.getUTCDay();

        let status: AttendanceStatus;
        if (holiday) status = 'holiday';
        else if (shiftPolicy.weeklyOffDays.includes(weekday)) status = 'week_off';
        else if (existing?.checkIn && !existing.checkOut) status = 'pending';
        else if (!existing?.checkIn) status = 'absent';
        else status = existing.status;

        await tx.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId: employee.id, date } },
          create: { tenantId: employee.tenantId, employeeId: employee.id, date, shiftPolicyId: shiftPolicy.id, status },
          update: { status },
        });
      }
    });
  }
}
