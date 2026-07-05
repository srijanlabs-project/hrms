import { Injectable } from '@nestjs/common';
import { CycleStatus, GoalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppErrors } from '../common/errors/app-error';
import { CreateReviewCycleDto } from './dto/review-cycle.dto';
import { CreateGoalDto, UpdateGoalProgressDto } from './dto/goal.dto';
import { CalibrateReviewDto, SubmitManagerReviewDto, SubmitSelfReviewDto } from './dto/performance-review.dto';

type Tx = Prisma.TransactionClient;

/**
 * Forward-only cycle state machine (Performance spec) — no skipping ahead and
 * no going backward. Index in this array = ordering; PATCH .../status only
 * accepts the very next status after the cycle's current one.
 */
const CYCLE_ORDER: CycleStatus[] = ['planned', 'goals_open', 'self_review', 'manager_review', 'calibration', 'closed'];

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // Review cycles
  // ---------------------------------------------------------------------

  async createCycle(tenantId: string, dto: CreateReviewCycleDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.reviewCycle.create({
        data: {
          tenantId,
          name: dto.name,
          periodStart: new Date(dto.periodStart),
          periodEnd: new Date(dto.periodEnd),
          selfReviewStart: new Date(dto.selfReviewStart),
          selfReviewEnd: new Date(dto.selfReviewEnd),
          managerReviewStart: new Date(dto.managerReviewStart),
          managerReviewEnd: new Date(dto.managerReviewEnd),
          calibrationStart: dto.calibrationStart ? new Date(dto.calibrationStart) : null,
          calibrationEnd: dto.calibrationEnd ? new Date(dto.calibrationEnd) : null,
          requireSelfFirst: dto.requireSelfFirst ?? true,
        },
      }),
    );
  }

  async listCycles(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) => tx.reviewCycle.findMany({ where: { tenantId }, orderBy: { periodStart: 'desc' } }));
  }

  async getCycle(tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const cycle = await tx.reviewCycle.findUnique({ where: { id } });
      if (!cycle) throw AppErrors.notFound('CYCLE_NOT_FOUND', 'Review cycle not found');
      return cycle;
    });
  }

  async updateCycleStatus(tenantId: string, id: string, nextStatus: CycleStatus) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const cycle = await tx.reviewCycle.findUnique({ where: { id } });
      if (!cycle) throw AppErrors.notFound('CYCLE_NOT_FOUND', 'Review cycle not found');

      const currentIndex = CYCLE_ORDER.indexOf(cycle.status);
      const nextIndex = CYCLE_ORDER.indexOf(nextStatus);
      if (nextIndex !== currentIndex + 1) {
        throw AppErrors.unprocessable(
          'INVALID_STATUS_TRANSITION',
          `Cannot move a cycle in status '${cycle.status}' directly to '${nextStatus}' — transitions are forward-only, one step at a time`,
        );
      }

      return tx.reviewCycle.update({ where: { id }, data: { status: nextStatus } });
    });
  }

  // ---------------------------------------------------------------------
  // Goals
  // ---------------------------------------------------------------------

  async createGoal(tenantId: string, dto: CreateGoalDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const cycle = await tx.reviewCycle.findUniqueOrThrow({ where: { id: dto.cycleId } });
      return tx.goal.create({
        data: {
          tenantId,
          employeeId: dto.employeeId,
          cycleId: cycle.id,
          parentGoalId: dto.parentGoalId,
          title: dto.title,
          type: dto.type,
          targetValue: dto.targetValue,
          weightPercent: dto.weightPercent ?? 100,
        },
      });
    });
  }

  async listGoals(tenantId: string, filters: { employeeId?: string; cycleId?: string }) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.goal.findMany({ where: { tenantId, employeeId: filters.employeeId, cycleId: filters.cycleId }, orderBy: { title: 'asc' } }),
    );
  }

  async updateGoalProgress(tenantId: string, goalId: string, dto: UpdateGoalProgressDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const goal = await tx.goal.findUnique({ where: { id: goalId } });
      if (!goal) throw AppErrors.notFound('GOAL_NOT_FOUND', 'Goal not found');
      return tx.goal.update({
        where: { id: goalId },
        data: {
          currentValue: dto.currentValue,
          progressPercent: dto.progressPercent,
          status: dto.status,
        },
      });
    });
  }

  /** Sum of an employee's active goals' weight for a cycle — must equal 100 before self-review can be submitted. */
  private async activeGoalWeightSum(tx: Tx, cycleId: string, employeeId: string): Promise<number> {
    const goals = await tx.goal.findMany({ where: { cycleId, employeeId, status: 'active' } });
    return goals.reduce((sum, g) => sum + g.weightPercent, 0);
  }

  // ---------------------------------------------------------------------
  // Performance reviews
  // ---------------------------------------------------------------------

  private async getOrCreateReview(tx: Tx, cycleId: string, employeeId: string) {
    const existing = await tx.performanceReview.findUnique({ where: { cycleId_employeeId: { cycleId, employeeId } } });
    if (existing) return existing;
    try {
      return await tx.performanceReview.create({ data: { cycleId, employeeId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw AppErrors.conflict('DUPLICATE_REVIEW', 'A performance review already exists for this employee in this cycle');
      }
      throw err;
    }
  }

  async submitSelfReview(tenantId: string, cycleId: string, employeeId: string, dto: SubmitSelfReviewDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const cycle = await tx.reviewCycle.findUniqueOrThrow({ where: { id: cycleId } });
      if (cycle.status !== 'self_review') {
        throw AppErrors.unprocessable('CYCLE_NOT_IN_WINDOW', "Self-reviews can only be submitted while the cycle is in the 'self_review' status");
      }

      const weightSum = await this.activeGoalWeightSum(tx, cycleId, employeeId);
      if (weightSum !== 100) {
        throw AppErrors.unprocessable('GOAL_WEIGHTS_INVALID', `Active goal weights must sum to 100 (currently ${weightSum})`);
      }

      const review = await this.getOrCreateReview(tx, cycleId, employeeId);
      if (review.status !== 'pending') {
        throw AppErrors.conflict('DUPLICATE_REVIEW', 'A self-review has already been submitted for this employee in this cycle');
      }

      return tx.performanceReview.update({
        where: { id: review.id },
        data: { selfRating: dto.selfRating, selfComments: dto.selfComments, status: 'self_submitted' },
      });
    });
  }

  async submitManagerReview(tenantId: string, cycleId: string, employeeId: string, dto: SubmitManagerReviewDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const cycle = await tx.reviewCycle.findUniqueOrThrow({ where: { id: cycleId } });
      if (cycle.status !== 'manager_review') {
        throw AppErrors.unprocessable('CYCLE_NOT_IN_WINDOW', "Manager reviews can only be submitted while the cycle is in the 'manager_review' status");
      }

      const review = await this.getOrCreateReview(tx, cycleId, employeeId);
      if (cycle.requireSelfFirst && review.selfRating == null) {
        throw AppErrors.unprocessable('MANAGER_REVIEW_BEFORE_SELF', "The employee's self-review must be submitted before the manager review");
      }
      if (review.status === 'manager_submitted' || review.status === 'calibrated' || review.status === 'acknowledged') {
        throw AppErrors.conflict('DUPLICATE_REVIEW', 'A manager review has already been submitted for this employee in this cycle');
      }

      return tx.performanceReview.update({
        where: { id: review.id },
        data: { managerRating: dto.managerRating, managerComments: dto.managerComments, status: 'manager_submitted' },
      });
    });
  }

  async calibrateReview(tenantId: string, cycleId: string, employeeId: string, dto: CalibrateReviewDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const cycle = await tx.reviewCycle.findUniqueOrThrow({ where: { id: cycleId } });
      if (cycle.status !== 'calibration') {
        throw AppErrors.unprocessable('CYCLE_NOT_IN_WINDOW', "Ratings can only be calibrated while the cycle is in the 'calibration' status");
      }

      const review = await tx.performanceReview.findUnique({ where: { cycleId_employeeId: { cycleId, employeeId } } });
      if (!review) throw AppErrors.notFound('REVIEW_NOT_FOUND', 'Performance review not found for this employee in this cycle');

      return tx.performanceReview.update({
        where: { id: review.id },
        data: { calibratedRating: dto.calibratedRating, status: 'calibrated' },
      });
    });
  }

  async listReviews(tenantId: string, cycleId: string) {
    return this.prisma.withTenant(tenantId, (tx) => tx.performanceReview.findMany({ where: { cycleId }, orderBy: { employeeId: 'asc' } }));
  }

  /**
   * PerformanceReview.finalRating is a real Postgres GENERATED ALWAYS column
   * (Unsupported("decimal(2,1)") in schema.prisma) — never selected/written via
   * Prisma. The "effective final rating" exposed here is always recomputed in
   * application code as calibratedRating ?? managerRating, mirroring exactly
   * what the DB-side generated column computes (see migration
   * 20260704202858_rls_and_generated_columns).
   */
  private effectiveFinalRating(review: { calibratedRating: Prisma.Decimal | null; managerRating: Prisma.Decimal | null }): number | null {
    const rating = review.calibratedRating ?? review.managerRating;
    return rating != null ? Number(rating) : null;
  }

  async ratingDistribution(tenantId: string, cycleId: string, departmentId?: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const reviews = await tx.performanceReview.findMany({ where: { cycleId } });

      let scoped = reviews;
      if (departmentId) {
        const employeeIds = new Set(
          (await tx.employee.findMany({ where: { tenantId, departmentId }, select: { id: true } })).map((e) => e.id),
        );
        scoped = reviews.filter((r) => employeeIds.has(r.employeeId));
      }

      const histogram: Record<string, number> = {};
      let rated = 0;
      for (const review of scoped) {
        const rating = this.effectiveFinalRating(review);
        if (rating == null) continue;
        const bucket = rating.toFixed(1);
        histogram[bucket] = (histogram[bucket] ?? 0) + 1;
        rated++;
      }

      return {
        cycleId,
        departmentId: departmentId ?? null,
        totalEmployees: scoped.length,
        ratedCount: rated,
        histogram,
      };
    });
  }
}
