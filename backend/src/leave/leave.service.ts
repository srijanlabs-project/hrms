import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AttendanceStatus, LeaveRequestStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppErrors } from '../common/errors/app-error';
import { ApprovalsService } from '../approvals/approvals.service';
import { AttendanceService } from '../attendance/attendance.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { RequestUser } from '../common/auth/request-user';
import { SystemRole } from '../common/auth/roles.enum';

type Tx = Prisma.TransactionClient;

function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function enumerateDates(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function balanceOf(b: { openingBalance: Prisma.Decimal; accrued: Prisma.Decimal; adjusted: Prisma.Decimal; used: Prisma.Decimal }): number {
  return Number(b.openingBalance) + Number(b.accrued) + Number(b.adjusted) - Number(b.used);
}

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
    private readonly attendance: AttendanceService,
  ) {}

  async createLeaveType(tenantId: string, dto: CreateLeaveTypeDto) {
    if (dto.accrualFrequency === 'monthly' && !dto.accrualDayOfMonth) {
      throw AppErrors.badRequest('ACCRUAL_DAY_REQUIRED', 'accrualDayOfMonth is required for monthly accrual');
    }
    if (dto.encashable && dto.encashmentMaxDays == null) {
      throw AppErrors.badRequest('ENCASHMENT_MAX_DAYS_REQUIRED', 'encashmentMaxDays is required when encashable is true');
    }
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.leaveType.create({ data: { tenantId, ...dto } }),
    );
  }

  async listLeaveTypes(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) => tx.leaveType.findMany({ where: { tenantId, isActive: true } }));
  }

  async getBalances(tenantId: string, employeeId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const balances = await tx.leaveBalance.findMany({ where: { tenantId, employeeId }, include: { leaveType: true } });
      const currentPeriodByType = new Map<string, typeof balances>();
      for (const b of balances) {
        if (!currentPeriodByType.has(b.leaveTypeId)) currentPeriodByType.set(b.leaveTypeId, []);
        currentPeriodByType.get(b.leaveTypeId)!.push(b);
      }
      const result = [];
      for (const [, rows] of currentPeriodByType) {
        const latest = rows.sort((a, b) => b.period.localeCompare(a.period))[0];
        result.push({
          leaveTypeCode: latest.leaveType.code,
          opening: Number(latest.openingBalance),
          accrued: Number(latest.accrued),
          used: Number(latest.used),
          adjusted: Number(latest.adjusted),
          balance: balanceOf(latest),
        });
      }
      return { employeeId, asOf: new Date().toISOString().slice(0, 10), balances: result };
    });
  }

  private periodFor(frequency: string, date: Date): string {
    return frequency === 'monthly' ? date.toISOString().slice(0, 7) : String(date.getUTCFullYear());
  }

  private async getOrCreateBalance(tx: Tx, tenantId: string, employeeId: string, leaveTypeId: string, period: string) {
    const existing = await tx.leaveBalance.findUnique({ where: { employeeId_leaveTypeId_period: { employeeId, leaveTypeId, period } } });
    if (existing) return existing;
    return tx.leaveBalance.create({ data: { tenantId, employeeId, leaveTypeId, period } });
  }

  private async computeTotalDays(
    tx: Tx,
    tenantId: string,
    employee: { id: string; workLocationId: string | null; departmentId: string | null },
    startDate: Date,
    endDate: Date,
    isStartHalfDay: boolean,
    isEndHalfDay: boolean,
  ): Promise<number> {
    const allDates = enumerateDates(startDate, endDate);
    const holidays = employee.workLocationId
      ? await tx.holiday.findMany({ where: { locationId: employee.workLocationId, date: { gte: startDate, lte: endDate } } })
      : [];
    const holidaySet = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
    const shiftPolicy = await this.attendance.resolveShiftPolicy(tx, tenantId, employee.departmentId).catch(() => null);
    const weeklyOffDays = new Set(shiftPolicy?.weeklyOffDays ?? []);

    const workingDates = allDates.filter((d) => !holidaySet.has(d.toISOString().slice(0, 10)) && !weeklyOffDays.has(d.getUTCDay()));
    let total = workingDates.length;
    if (isStartHalfDay) total -= 0.5;
    if (isEndHalfDay) total -= 0.5;
    return total;
  }

  async applyLeave(tenantId: string, actingUser: RequestUser, dto: ApplyLeaveDto) {
    const subjectEmployeeId = dto.onBehalfOfEmployeeId && actingUser.roleName === SystemRole.HR_ADMIN
      ? dto.onBehalfOfEmployeeId
      : actingUser.employeeId!;
    const isHrAdmin = actingUser.roleName === SystemRole.HR_ADMIN;

    return this.prisma.withTenant(tenantId, async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: subjectEmployeeId } });
      if (!employee) throw AppErrors.badRequest('EMPLOYEE_NOT_FOUND', 'Employee not found', 'onBehalfOfEmployeeId');
      if (!['active', 'on_notice'].includes(employee.employmentStatus)) {
        throw AppErrors.unprocessable('EMPLOYEE_NOT_ACTIVE', 'Cannot apply for leave on an inactive employee record');
      }

      const leaveType = await tx.leaveType.findFirst({ where: { id: dto.leaveTypeId, tenantId, isActive: true } });
      if (!leaveType) throw AppErrors.badRequest('LEAVE_TYPE_NOT_FOUND', 'leaveTypeId not found', 'leaveTypeId');

      const startDate = dateOnly(new Date(dto.startDate));
      const endDate = dateOnly(new Date(dto.endDate));
      if (endDate < startDate) throw AppErrors.badRequest('INVALID_RANGE', 'endDate must be >= startDate');
      if (startDate.getTime() === endDate.getTime() && dto.isStartHalfDay && dto.isEndHalfDay) {
        throw AppErrors.badRequest('INVALID_HALF_DAY', 'Only one half-day flag may be set for a single-day request');
      }

      if (leaveType.applicableGender !== 'all' && employee.gender !== leaveType.applicableGender) {
        throw AppErrors.unprocessable('NOT_ELIGIBLE_GENDER', 'This leave type is not applicable to your profile');
      }
      if (leaveType.applicableEmploymentTypes.length > 0 && !leaveType.applicableEmploymentTypes.includes(employee.employmentType)) {
        throw AppErrors.unprocessable('NOT_ELIGIBLE_EMPLOYMENT_TYPE', 'This leave type is not applicable to your employment type');
      }
      if (leaveType.minDaysNotice > 0 && !isHrAdmin) {
        const minStart = new Date();
        minStart.setUTCDate(minStart.getUTCDate() + leaveType.minDaysNotice);
        if (startDate < dateOnly(minStart)) {
          throw AppErrors.unprocessable('INSUFFICIENT_NOTICE', `This leave type requires ${leaveType.minDaysNotice} days notice`);
        }
      }

      const totalDays = await this.computeTotalDays(
        tx, tenantId, employee, startDate, endDate, dto.isStartHalfDay ?? false, dto.isEndHalfDay ?? false,
      );
      if (totalDays <= 0) {
        throw AppErrors.unprocessable('INVALID_RANGE', 'Selected range contains no working days');
      }
      if (leaveType.maxConsecutiveDays && totalDays > leaveType.maxConsecutiveDays) {
        throw AppErrors.unprocessable('MAX_CONSECUTIVE_EXCEEDED', `Maximum ${leaveType.maxConsecutiveDays} consecutive days allowed for this leave type`);
      }
      if (leaveType.requiresDocumentAboveDays != null && totalDays > leaveType.requiresDocumentAboveDays && !dto.documentUrl) {
        throw AppErrors.unprocessable('DOCUMENT_REQUIRED', 'Supporting document required for this duration');
      }

      const overlapping = await tx.leaveRequest.findFirst({
        where: {
          employeeId: subjectEmployeeId,
          status: { in: ['pending', 'approved'] },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      });
      if (overlapping) {
        throw AppErrors.conflict('OVERLAPPING_REQUEST', 'You already have a leave request overlapping these dates');
      }

      if (!leaveType.allowNegativeBalance) {
        const period = this.periodFor(leaveType.accrualFrequency, startDate);
        const balance = await this.getOrCreateBalance(tx, tenantId, subjectEmployeeId, leaveType.id, period);
        const available = balanceOf(balance);
        if (available < totalDays) {
          throw AppErrors.unprocessable('INSUFFICIENT_BALANCE', `Insufficient leave balance (${available} available)`, 'leaveTypeId');
        }
      }

      const { instance, currentApprover } = await this.approvals.createInstance(tx, {
        tenantId,
        applicability: 'leave',
        subjectEmployeeId,
      });

      const leaveRequest = await tx.leaveRequest.create({
        data: {
          tenantId,
          employeeId: subjectEmployeeId,
          leaveTypeId: leaveType.id,
          startDate,
          endDate,
          isStartHalfDay: dto.isStartHalfDay ?? false,
          isEndHalfDay: dto.isEndHalfDay ?? false,
          totalDays,
          reason: dto.reason,
          documentUrl: dto.documentUrl,
          approvalInstanceId: instance.id,
        },
      });

      return { ...leaveRequest, currentApprover };
    });
  }

  async list(tenantId: string, filters: { employeeId?: string; status?: string; from?: string; to?: string }) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.leaveRequest.findMany({
        where: {
          tenantId,
          employeeId: filters.employeeId,
          status: filters.status ? { in: filters.status.split(',') as LeaveRequestStatus[] } : undefined,
          startDate: filters.from ? { gte: new Date(filters.from) } : undefined,
        },
        orderBy: { appliedAt: 'desc' },
      }),
    );
  }

  async decide(tenantId: string, requestId: string, actingUser: RequestUser, decision: 'approve' | 'reject', comment?: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const request = await tx.leaveRequest.findUnique({ where: { id: requestId } });
      if (!request || !request.approvalInstanceId) throw AppErrors.notFound('LEAVE_REQUEST_NOT_FOUND', 'Leave request not found');
      if (request.status !== 'pending' && request.status !== 'cancellation_pending') {
        throw AppErrors.conflict('ALREADY_DECIDED', 'This leave request has already been decided');
      }

      // The real concurrency guard for "two managers can't both decide the same
      // step" (spec §8 acceptance criteria) is approvals.decide()'s conditional
      // update on ApprovalInstance(status, currentStep) — the second concurrent
      // caller gets ALREADY_DECIDED thrown from there, before reaching here.
      // LeaveRequest.version is still bumped below to match the spec's field,
      // but it isn't the primary mutex.
      const { instance } = await this.approvals.decide(tx, request.approvalInstanceId, actingUser, decision, comment);
      const wasCancellation = request.status === 'cancellation_pending';

      if (instance.status === 'rejected') {
        await tx.leaveRequest.update({
          where: { id: requestId, version: request.version },
          data: { status: wasCancellation ? 'approved' : 'rejected', decidedAt: new Date(), decisionComment: comment, version: { increment: 1 } },
        });
      } else if (instance.status === 'approved') {
        if (wasCancellation) {
          await this.revertApprovedLeave(tx, request);
          await tx.leaveRequest.update({ where: { id: requestId }, data: { status: 'cancelled', decidedAt: new Date(), version: { increment: 1 } } });
        } else {
          await this.applyApprovedLeave(tx, request);
          await tx.leaveRequest.update({ where: { id: requestId }, data: { status: 'approved', decidedAt: new Date(), decisionComment: comment, version: { increment: 1 } } });
        }
      }
      return tx.leaveRequest.findUniqueOrThrow({ where: { id: requestId } });
    });
  }

  private async applyApprovedLeave(tx: Tx, request: { tenantId: string; employeeId: string; leaveTypeId: string; startDate: Date; endDate: Date; totalDays: Prisma.Decimal; isStartHalfDay: boolean; isEndHalfDay: boolean; id: string }) {
    const leaveType = await tx.leaveType.findUniqueOrThrow({ where: { id: request.leaveTypeId } });
    const period = this.periodFor(leaveType.accrualFrequency, request.startDate);
    const balance = await this.getOrCreateBalance(tx, request.tenantId, request.employeeId, request.leaveTypeId, period);
    await tx.leaveBalance.update({ where: { id: balance.id }, data: { used: { increment: request.totalDays } } });

    const employee = await tx.employee.findUniqueOrThrow({ where: { id: request.employeeId } });
    const shiftPolicy = await this.attendance.resolveShiftPolicy(tx, request.tenantId, employee.departmentId).catch(() => null);
    const dates = enumerateDates(request.startDate, request.endDate);
    for (const date of dates) {
      if (shiftPolicy?.weeklyOffDays.includes(date.getUTCDay())) continue;
      const isBoundaryHalf = (request.isStartHalfDay && date.getTime() === request.startDate.getTime()) ||
        (request.isEndHalfDay && date.getTime() === request.endDate.getTime());
      const status: AttendanceStatus = isBoundaryHalf ? 'half_day' : 'on_leave';
      await tx.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: request.employeeId, date } },
        create: { tenantId: request.tenantId, employeeId: request.employeeId, date, shiftPolicyId: shiftPolicy?.id ?? '', status, sourceLeaveRequestId: request.id },
        update: { status, sourceLeaveRequestId: request.id },
      });
    }
  }

  private async revertApprovedLeave(tx: Tx, request: { tenantId: string; employeeId: string; leaveTypeId: string; startDate: Date; endDate: Date; totalDays: Prisma.Decimal }) {
    const leaveType = await tx.leaveType.findUniqueOrThrow({ where: { id: request.leaveTypeId } });
    const period = this.periodFor(leaveType.accrualFrequency, request.startDate);
    const balance = await this.getOrCreateBalance(tx, request.tenantId, request.employeeId, request.leaveTypeId, period);
    await tx.leaveBalance.update({ where: { id: balance.id }, data: { used: { decrement: request.totalDays } } });

    const dates = enumerateDates(request.startDate, request.endDate);
    for (const date of dates) {
      await tx.attendanceRecord.updateMany({
        where: { employeeId: request.employeeId, date, status: { in: ['on_leave', 'half_day'] } },
        data: { status: 'absent', sourceLeaveRequestId: null },
      });
    }
  }

  async cancel(tenantId: string, employeeId: string, requestId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const request = await tx.leaveRequest.findUnique({ where: { id: requestId } });
      if (!request || request.employeeId !== employeeId) throw AppErrors.notFound('LEAVE_REQUEST_NOT_FOUND', 'Leave request not found');

      if (request.status === 'pending') {
        return tx.leaveRequest.update({ where: { id: requestId }, data: { status: 'withdrawn' } });
      }
      if (request.status === 'approved') {
        if (request.endDate < dateOnly(new Date())) {
          throw AppErrors.unprocessable('LEAVE_ALREADY_CONSUMED', 'Cannot cancel a leave whose end date has passed');
        }
        const { instance } = await this.approvals.createInstance(tx, { tenantId, applicability: 'leave', subjectEmployeeId: employeeId });
        return tx.leaveRequest.update({ where: { id: requestId }, data: { status: 'cancellation_pending', approvalInstanceId: instance.id } });
      }
      throw AppErrors.conflict('INVALID_STATE', `Cannot cancel a request in status ${request.status}`);
    });
  }

  /** Runs daily; credits monthly-accrual leave types whose accrualDayOfMonth matches today (spec §6.1). */
  @Cron('0 1 * * *')
  async monthlyAccrualJob() {
    const today = new Date();
    await this.prisma.withoutTenantScope(async (tx) => {
      const types = await tx.leaveType.findMany({ where: { accrualFrequency: 'monthly', isActive: true } });
      for (const type of types) {
        if (type.accrualDayOfMonth !== today.getUTCDate()) continue;
        const employees = await tx.employee.findMany({ where: { tenantId: type.tenantId, employmentStatus: { in: ['active', 'on_notice'] } } });
        const period = today.toISOString().slice(0, 7);
        for (const employee of employees) {
          const daysInMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
          const daysEmployed = employee.dateOfJoining.getUTCMonth() === today.getUTCMonth() && employee.dateOfJoining.getUTCFullYear() === today.getUTCFullYear()
            ? daysInMonth - employee.dateOfJoining.getUTCDate() + 1
            : daysInMonth;
          const rate = daysEmployed < daysInMonth
            ? Math.round(Number(type.accrualRate) * (daysEmployed / daysInMonth) * 10) / 10
            : Number(type.accrualRate);

          const balance = await this.getOrCreateBalance(tx, type.tenantId, employee.id, type.id, period);
          const projected = Number(balance.openingBalance) + Number(balance.accrued) + rate + Number(balance.adjusted) - Number(balance.used);
          const cappedRate = type.maxBalance != null && projected > Number(type.maxBalance)
            ? Math.max(0, Number(type.maxBalance) - (Number(balance.openingBalance) + Number(balance.accrued) + Number(balance.adjusted) - Number(balance.used)))
            : rate;

          await tx.leaveBalance.update({ where: { id: balance.id }, data: { accrued: { increment: cappedRate } } });
        }
      }
    });
  }

  /** Hourly escalation sweep — delegates to the generic Approvals engine job (spec §6.3). */
  @Cron('0 * * * *')
  async escalationJob() {
    await this.prisma.withoutTenantScope(async (tx) => {
      const tenants = await tx.tenant.findMany({ select: { id: true } });
      for (const t of tenants) {
        await this.approvals.escalateOverdueSteps(tx, t.id);
      }
    });
  }
}
