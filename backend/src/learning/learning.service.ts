import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, TrainingStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppErrors } from '../common/errors/app-error';
import { CreateCourseDto } from './dto/course.dto';
import { CompleteTrainingDto, CreateTrainingAssignmentDto } from './dto/training-assignment.dto';
import { CreateCertificationDto } from './dto/certification.dto';

type Tx = Prisma.TransactionClient;

const CERT_EXPIRY_REMINDER_WINDOW_DAYS = 30;
const CERT_EXPIRY_REMINDER_COOLDOWN_DAYS = 7;

@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // Courses
  // ---------------------------------------------------------------------

  async createCourse(tenantId: string, dto: CreateCourseDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.course.create({
        data: {
          tenantId,
          title: dto.title,
          description: dto.description,
          contentUrl: dto.contentUrl,
          durationMinutes: dto.durationMinutes,
          category: dto.category,
          isMandatory: dto.isMandatory ?? false,
          applicableDepartmentIds: dto.applicableDepartmentIds ?? [],
        },
      }),
    );
  }

  async listCourses(tenantId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const courses = await tx.course.findMany({ where: { tenantId, isActive: true }, orderBy: { title: 'asc' } });
      const assignments = await tx.trainingAssignment.groupBy({
        by: ['courseId', 'status'],
        where: { tenantId, courseId: { in: courses.map((c) => c.id) } },
        _count: true,
      });
      return courses.map((c) => {
        const forCourse = assignments.filter((a) => a.courseId === c.id);
        const total = forCourse.reduce((sum, a) => sum + a._count, 0);
        const completed = forCourse.find((a) => a.status === 'completed')?._count ?? 0;
        return { ...c, assignedCount: total, completedCount: completed };
      });
    });
  }

  // ---------------------------------------------------------------------
  // Training assignments
  // ---------------------------------------------------------------------

  /**
   * Bulk-assigns a course to either an explicit employeeIds list or every
   * (non-exited) employee currently in departmentId — a one-time snapshot at
   * assignment time per the Learning spec, not a live sync: an employee who
   * joins the department later gets nothing retroactively, and this method
   * isn't re-run automatically.
   */
  async createAssignments(tenantId: string, actingUserId: string, dto: CreateTrainingAssignmentDto) {
    if (!dto.employeeIds?.length && !dto.departmentId) {
      throw AppErrors.badRequest('MISSING_TARGET', 'Either employeeIds or departmentId is required');
    }

    return this.prisma.withTenant(tenantId, async (tx) => {
      const course = await tx.course.findUnique({ where: { id: dto.courseId } });
      if (!course) throw AppErrors.notFound('COURSE_NOT_FOUND', 'Course not found');
      if (!course.isActive) throw AppErrors.unprocessable('INACTIVE_COURSE', 'Cannot assign an inactive course');

      let targetEmployeeIds: string[];
      if (dto.departmentId) {
        if (course.applicableDepartmentIds.length > 0 && !course.applicableDepartmentIds.includes(dto.departmentId)) {
          throw AppErrors.unprocessable('NOT_APPLICABLE_DEPARTMENT', 'This course is not applicable to the given department');
        }
        const employees = await tx.employee.findMany({
          where: { tenantId, departmentId: dto.departmentId, employmentStatus: { not: 'exited' } },
          select: { id: true },
        });
        targetEmployeeIds = employees.map((e) => e.id);
      } else {
        targetEmployeeIds = dto.employeeIds!;
        if (course.applicableDepartmentIds.length > 0) {
          const employees = await tx.employee.findMany({
            where: { id: { in: targetEmployeeIds } },
            select: { id: true, departmentId: true },
          });
          const notApplicable = employees.find((e) => !e.departmentId || !course.applicableDepartmentIds.includes(e.departmentId));
          if (notApplicable) {
            throw AppErrors.unprocessable('NOT_APPLICABLE_DEPARTMENT', 'This course is not applicable to one or more of the given employees\' departments');
          }
        }
      }

      const created = [];
      const alreadyAssigned: string[] = [];
      for (const employeeId of targetEmployeeIds) {
        const existing = await tx.trainingAssignment.findUnique({ where: { courseId_employeeId: { courseId: course.id, employeeId } } });
        if (existing) {
          alreadyAssigned.push(employeeId);
          continue;
        }
        created.push(
          await tx.trainingAssignment.create({
            data: {
              tenantId,
              courseId: course.id,
              employeeId,
              assignedByUserId: actingUserId,
              dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            },
          }),
        );
      }

      // Bulk-assign is intentionally best-effort per employee (ALREADY_ASSIGNED for one
      // employee shouldn't roll back the rest of a department-wide assignment) — reported
      // back rather than thrown, unless every single target was already assigned and
      // the caller passed a single explicit employeeId (then it's unambiguous to raise).
      if (created.length === 0 && alreadyAssigned.length === 1 && dto.employeeIds?.length === 1) {
        throw AppErrors.conflict('ALREADY_ASSIGNED', 'This employee is already assigned to this course');
      }

      return { assigned: created, alreadyAssignedEmployeeIds: alreadyAssigned };
    });
  }

  async listAssignments(tenantId: string, filters: { employeeId?: string; courseId?: string; status?: TrainingStatus }) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const assignments = await tx.trainingAssignment.findMany({
        where: {
          tenantId,
          employeeId: filters.employeeId,
          courseId: filters.courseId,
          status: filters.status,
        },
        orderBy: { dueDate: 'asc' },
      });
      // TrainingAssignment has no Prisma relation to Employee (only the raw
      // employeeId column) — a small batched lookup rather than a schema change.
      const employees = await tx.employee.findMany({
        where: { id: { in: assignments.map((a) => a.employeeId) } },
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
      });
      const byId = new Map(employees.map((e) => [e.id, e]));
      return assignments.map((a) => ({ ...a, employee: byId.get(a.employeeId) ?? null }));
    });
  }

  async startAssignment(tenantId: string, assignmentId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const assignment = await tx.trainingAssignment.findUnique({ where: { id: assignmentId } });
      if (!assignment) throw AppErrors.notFound('ASSIGNMENT_NOT_FOUND', 'Training assignment not found');
      if (assignment.status !== 'assigned' && assignment.status !== 'overdue') {
        throw AppErrors.conflict('INVALID_STATE', `Cannot start an assignment in status ${assignment.status}`);
      }
      return tx.trainingAssignment.update({ where: { id: assignmentId }, data: { status: 'in_progress' } });
    });
  }

  async completeAssignment(tenantId: string, assignmentId: string, dto: CompleteTrainingDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const assignment = await tx.trainingAssignment.findUnique({ where: { id: assignmentId } });
      if (!assignment) throw AppErrors.notFound('ASSIGNMENT_NOT_FOUND', 'Training assignment not found');
      if (assignment.status === 'completed') return assignment; // idempotent — retry-safe

      return tx.trainingAssignment.update({
        where: { id: assignmentId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          feedbackRating: dto.feedbackRating,
          feedbackComments: dto.feedbackComments,
        },
      });
    });
  }

  /** Nightly sweep — flips assigned/in_progress assignments whose dueDate has passed to 'overdue'. */
  @Cron('0 2 * * *')
  async flipOverdueAssignments() {
    await this.prisma.withoutTenantScope(async (tx) => {
      const result = await tx.trainingAssignment.updateMany({
        where: { status: { in: ['assigned', 'in_progress'] }, dueDate: { lt: new Date() } },
        data: { status: 'overdue' },
      });
      if (result.count > 0) {
        this.logger.log(`Flipped ${result.count} training assignment(s) to overdue`);
      }
    });
  }

  // ---------------------------------------------------------------------
  // Certifications
  // ---------------------------------------------------------------------

  async createCertification(tenantId: string, dto: CreateCertificationDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.certification.create({
        data: {
          tenantId,
          employeeId: dto.employeeId,
          name: dto.name,
          issuingBody: dto.issuingBody,
          issuedDate: new Date(dto.issuedDate),
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          documentUrl: dto.documentUrl,
        },
      }),
    );
  }

  async listExpiring(tenantId: string, withinDays?: number) {
    const horizon = new Date(Date.now() + (withinDays ?? CERT_EXPIRY_REMINDER_WINDOW_DAYS) * 86_400_000);
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.certification.findMany({
        where: { tenantId, expiryDate: { not: null, lte: horizon, gte: new Date() } },
        orderBy: { expiryDate: 'asc' },
      }),
    );
  }

  /**
   * Nightly sweep — logs a reminder for certifications expiring within the
   * default 30-day window, at most once every 7 days per certification
   * (reminderSentAt gate). No real notification channel is wired up (per
   * spec) — this only Logger.logs, which is enough to prove the sweep runs
   * and to be swapped for a real notifier later without touching the gate logic.
   */
  @Cron('30 2 * * *')
  async sendCertificationExpiryReminders() {
    await this.prisma.withoutTenantScope(async (tx: Tx) => {
      const horizon = new Date(Date.now() + CERT_EXPIRY_REMINDER_WINDOW_DAYS * 86_400_000);
      const cooldownCutoff = new Date(Date.now() - CERT_EXPIRY_REMINDER_COOLDOWN_DAYS * 86_400_000);

      const candidates = await tx.certification.findMany({
        where: {
          expiryDate: { not: null, lte: horizon, gte: new Date() },
          OR: [{ reminderSentAt: null }, { reminderSentAt: { lt: cooldownCutoff } }],
        },
      });

      for (const cert of candidates) {
        this.logger.log(
          `Certification expiry reminder: employeeId=${cert.employeeId} certification="${cert.name}" expiresOn=${cert.expiryDate?.toISOString().slice(0, 10)}`,
        );
        await tx.certification.update({ where: { id: cert.id }, data: { reminderSentAt: new Date() } });
      }
    });
  }
}
