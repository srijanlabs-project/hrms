import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClearanceDept, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppErrors } from '../common/errors/app-error';
import { EmployeesService } from '../employee-core/employees.service';
import { PayrollService } from '../payroll/payroll.service';
import { AssetsService } from '../assets/assets.service';
import { RequestUser } from '../common/auth/request-user';
import { CreateExitRequestDto, UpdateLastWorkingDayDto, UpdateClearanceTaskDto, SubmitExitInterviewDto } from './dto/exit.dto';

type Tx = Prisma.TransactionClient;

const DEFAULT_NOTICE_PERIOD_DAYS = 30;
const CLEARANCE_DEPARTMENTS: ClearanceDept[] = ['it', 'finance', 'admin', 'manager'];

@Injectable()
export class ExitService {
  private readonly logger = new Logger(ExitService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly payroll: PayrollService,
    private readonly assets: AssetsService,
  ) {}

  async createExitRequest(tenantId: string, dto: CreateExitRequestDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: dto.employeeId }, include: { designation: true } });
      if (!employee) throw AppErrors.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');

      const existing = await tx.exitRequest.findFirst({
        where: { tenantId, employeeId: dto.employeeId, status: { in: ['notice_period', 'clearance_pending'] } },
      });
      if (existing) throw AppErrors.conflict('ALREADY_ON_NOTICE', 'This employee already has an active exit in progress');

      const noticePeriodDays = employee.designation?.noticePeriodDays ?? DEFAULT_NOTICE_PERIOD_DAYS;
      const resignationDate = new Date(dto.resignationDate);
      const lastWorkingDay = new Date(resignationDate.getTime() + noticePeriodDays * 86_400_000);

      const exitRequest = await tx.exitRequest.create({
        data: {
          tenantId,
          employeeId: dto.employeeId,
          initiatedBy: dto.initiatedBy,
          resignationDate,
          noticePeriodDays,
          lastWorkingDay,
          reasonCategory: dto.reasonCategory,
          reasonNotes: dto.reasonNotes,
          status: 'notice_period',
        },
      });

      await this.employees.setEmploymentStatus(tx, tenantId, dto.employeeId, 'on_notice');
      return exitRequest;
    });
  }

  async listExitRequests(tenantId: string, employeeId?: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.exitRequest.findMany({
        where: { tenantId, employeeId },
        include: { clearanceTasks: true, exitInterview: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async updateLastWorkingDay(tenantId: string, exitRequestId: string, actorUserId: string, dto: UpdateLastWorkingDayDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const exitRequest = await tx.exitRequest.findUnique({ where: { id: exitRequestId } });
      if (!exitRequest) throw AppErrors.notFound('EXIT_REQUEST_NOT_FOUND', 'Exit request not found');
      if (exitRequest.status !== 'notice_period' && exitRequest.status !== 'clearance_pending') {
        throw AppErrors.conflict('CLEARANCE_NOT_COMPLETE', 'Last working day can only be changed while the exit is in progress');
      }

      const newLwd = new Date(dto.lastWorkingDay);
      if (newLwd < new Date(new Date().toDateString())) {
        throw AppErrors.badRequest('LWD_BEFORE_TODAY', 'Last working day cannot be in the past', 'lastWorkingDay');
      }

      // Compliance-sensitive change — always require+log a reason.
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId,
          entityType: 'exit_request',
          entityId: exitRequestId,
          action: 'last_working_day_changed',
          beforeValue: { lastWorkingDay: exitRequest.lastWorkingDay } as unknown as Prisma.InputJsonValue,
          afterValue: { lastWorkingDay: newLwd } as unknown as Prisma.InputJsonValue,
          comment: dto.reason,
        },
      });

      return tx.exitRequest.update({ where: { id: exitRequestId }, data: { lastWorkingDay: newLwd } });
    });
  }

  async startClearance(tenantId: string, exitRequestId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const exitRequest = await tx.exitRequest.findUnique({ where: { id: exitRequestId } });
      if (!exitRequest) throw AppErrors.notFound('EXIT_REQUEST_NOT_FOUND', 'Exit request not found');
      if (exitRequest.status !== 'notice_period') {
        throw AppErrors.conflict('ALREADY_ON_NOTICE', 'Clearance can only be started from notice_period');
      }

      const employee = await tx.employee.findUniqueOrThrow({ where: { id: exitRequest.employeeId } });
      const hrAdmin = await this.resolveHrAdminUser(tx, tenantId);

      let managerUserId: string | undefined;
      if (employee.managerId) {
        const managerUser = await tx.user.findUnique({ where: { employeeId: employee.managerId } });
        managerUserId = managerUser?.id;
      }

      const existingTasks = await tx.clearanceTask.findMany({ where: { exitRequestId } });
      const existingDepts = new Set(existingTasks.map((t) => t.department));

      const tasksToCreate: { department: ClearanceDept; assigneeUserId: string | undefined }[] = [
        ...CLEARANCE_DEPARTMENTS.filter((d) => d !== 'manager').map((d) => ({ department: d, assigneeUserId: hrAdmin?.id })),
        { department: 'manager' as ClearanceDept, assigneeUserId: managerUserId ?? hrAdmin?.id },
      ];

      for (const task of tasksToCreate) {
        if (existingDepts.has(task.department)) continue;
        if (!task.assigneeUserId) {
          this.logger.warn(`No assignee resolvable for clearance task department=${task.department} exitRequest=${exitRequestId} — skipping creation`);
          continue;
        }
        await tx.clearanceTask.create({
          data: {
            exitRequestId,
            department: task.department,
            assigneeUserId: task.assigneeUserId,
            checklistItems: [] as unknown as Prisma.InputJsonValue,
            status: 'pending',
          },
        });
      }

      return tx.exitRequest.update({ where: { id: exitRequestId }, data: { status: 'clearance_pending' } });
    });
  }

  async withdraw(tenantId: string, exitRequestId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const exitRequest = await tx.exitRequest.findUnique({ where: { id: exitRequestId } });
      if (!exitRequest) throw AppErrors.notFound('EXIT_REQUEST_NOT_FOUND', 'Exit request not found');

      if (exitRequest.status === 'clearance_pending') {
        const clearedCount = await tx.clearanceTask.count({ where: { exitRequestId, status: 'cleared' } });
        if (clearedCount > 0) {
          throw AppErrors.conflict('WITHDRAWAL_AFTER_CLEARANCE_START', 'Cannot withdraw once clearance tasks have started clearing');
        }
      } else if (exitRequest.status !== 'notice_period') {
        throw AppErrors.conflict('WITHDRAWAL_AFTER_CLEARANCE_START', 'This exit request can no longer be withdrawn');
      }

      await this.employees.setEmploymentStatus(tx, tenantId, exitRequest.employeeId, 'active');
      return tx.exitRequest.update({ where: { id: exitRequestId }, data: { status: 'withdrawn' } });
    });
  }

  async updateClearanceTask(tenantId: string, taskId: string, dto: UpdateClearanceTaskDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const task = await tx.clearanceTask.findUnique({ where: { id: taskId } });
      if (!task) throw AppErrors.notFound('CLEARANCE_TASK_NOT_FOUND', 'Clearance task not found');

      const updated = await tx.clearanceTask.update({
        where: { id: taskId },
        data: {
          status: dto.status,
          checklistItems: dto.checklistItems ? (dto.checklistItems as unknown as Prisma.InputJsonValue) : undefined,
          blockedReason: dto.status === 'blocked' ? dto.blockedReason : dto.status ? null : undefined,
          clearedAt: dto.status === 'cleared' ? new Date() : dto.status ? null : undefined,
        },
      });

      await this.tryCompleteExit(tx, task.exitRequestId);
      return updated;
    });
  }

  async submitExitInterview(tenantId: string, exitRequestId: string, dto: SubmitExitInterviewDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const exitRequest = await tx.exitRequest.findUnique({ where: { id: exitRequestId }, include: { exitInterview: true } });
      if (!exitRequest) throw AppErrors.notFound('EXIT_REQUEST_NOT_FOUND', 'Exit request not found');
      if (!exitRequest.exitInterview) {
        throw AppErrors.conflict('CLEARANCE_NOT_COMPLETE', 'Exit interview is only available once the exit is finalized');
      }

      return tx.exitInterview.update({
        where: { exitRequestId },
        data: {
          responses: dto.responses as unknown as Prisma.InputJsonValue,
          overallSentiment: dto.overallSentiment,
          submittedAt: new Date(),
        },
      });
    });
  }

  /** Called after a clearance task update, and again by the daily cron sweep — both call sites are
   *  safe because createFullAndFinalRun / this method's own DB reads are idempotent per exitRequestId. */
  private async tryCompleteExit(tx: Tx, exitRequestId: string) {
    const exitRequest = await tx.exitRequest.findUnique({ where: { id: exitRequestId } });
    if (!exitRequest || exitRequest.status !== 'clearance_pending') return;

    const tasks = await tx.clearanceTask.findMany({ where: { exitRequestId } });
    const expectedDepts = CLEARANCE_DEPARTMENTS.length;
    const allCleared = tasks.length >= expectedDepts && tasks.every((t) => t.status === 'cleared');
    const pastLwd = new Date() >= new Date(exitRequest.lastWorkingDay);
    if (!allCleared || !pastLwd) return;

    await this.employees.setEmploymentStatus(tx, exitRequest.tenantId, exitRequest.employeeId, 'exited');

    const period = new Date().toISOString().slice(0, 7);
    await this.payroll.createFullAndFinalRun(tx, exitRequest.tenantId, exitRequestId, period);

    const existingInterview = await tx.exitInterview.findUnique({ where: { exitRequestId } });
    if (!existingInterview) {
      await tx.exitInterview.create({
        data: { exitRequestId, conductedByUserId: null, responses: [] as unknown as Prisma.InputJsonValue },
      });
    }

    // Informational only — soft failure, never blocks exit finalization.
    try {
      const unreturned = await this.assets.getUnreturnedAssetsForExitedEmployee(exitRequest.tenantId, exitRequest.employeeId);
      if (unreturned.length > 0) {
        this.logger.warn(`Employee ${exitRequest.employeeId} exited with ${unreturned.length} unreturned asset(s)`);
      }
    } catch (err) {
      this.logger.warn(`Could not check unreturned assets for employee ${exitRequest.employeeId}`, err as Error);
    }

    await tx.exitRequest.update({ where: { id: exitRequestId }, data: { status: 'cleared' } });
  }

  private async resolveHrAdminUser(tx: Tx, tenantId: string) {
    return tx.user.findFirst({ where: { tenantId, role: { name: 'HR Admin' } } });
  }

  /** Belt-and-suspenders alongside the PATCH-triggered check in updateClearanceTask —
   *  catches exits whose lastWorkingDay only arrives after all tasks were already cleared. */
  @Cron('0 3 * * *')
  async sweepClearancePendingExits() {
    await this.prisma.withoutTenantScope(async (tx) => {
      const candidates = await tx.exitRequest.findMany({
        where: { status: 'clearance_pending', lastWorkingDay: { lte: new Date() } },
      });
      for (const exitRequest of candidates) {
        try {
          await this.tryCompleteExit(tx, exitRequest.id);
        } catch (err) {
          this.logger.error(`Failed to finalize exit request ${exitRequest.id} in cron sweep`, err as Error);
        }
      }
    });
  }
}
