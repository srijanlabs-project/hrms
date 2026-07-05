import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CandidateStage, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppErrors } from '../common/errors/app-error';
import { ApprovalsService } from '../approvals/approvals.service';
import { EmployeesService } from '../employee-core/employees.service';
import { RequestUser } from '../common/auth/request-user';
import { SystemRole } from '../common/auth/roles.enum';
import {
  CreateCandidateDto, CreateOfferDto, CreateRequisitionDto, ScheduleInterviewDto, SendOfferDto, StageChangeDto, SubmitScorecardDto,
} from './dto/recruitment.dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class RecruitmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
    private readonly employees: EmployeesService,
  ) {}

  async createRequisition(tenantId: string, actingUser: RequestUser, dto: CreateRequisitionDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      if (!actingUser.employeeId) {
        throw AppErrors.badRequest('REQUESTER_NOT_LINKED_TO_EMPLOYEE', 'Requisition approval requires the requester to have a linked employee record');
      }
      const requisition = await tx.jobRequisition.create({
        data: {
          tenantId,
          title: dto.title,
          departmentId: dto.departmentId,
          headcount: dto.headcount,
          employmentType: dto.employmentType,
          budgetCtcMax: dto.budgetCtcMax,
          targetCloseDate: dto.targetCloseDate ? new Date(dto.targetCloseDate) : null,
          requestedByUserId: actingUser.userId,
          status: 'draft',
        },
      });

      const { instance } = await this.approvals.createInstance(tx, {
        tenantId, applicability: 'requisition', subjectEmployeeId: actingUser.employeeId,
      });
      return tx.jobRequisition.update({ where: { id: requisition.id }, data: { status: 'pending_approval', approvalInstanceId: instance.id } });
    });
  }

  async listRequisitions(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) => tx.jobRequisition.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }));
  }

  async decideRequisition(tenantId: string, id: string, actingUser: RequestUser, decision: 'approve' | 'reject', comment?: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const requisition = await tx.jobRequisition.findUniqueOrThrow({ where: { id } });
      if (!requisition.approvalInstanceId) throw AppErrors.conflict('NO_APPROVAL_INSTANCE', 'This requisition has no pending approval');
      const { instance } = await this.approvals.decide(tx, requisition.approvalInstanceId, actingUser, decision, comment);
      const status = instance.status === 'approved' ? 'open' : instance.status === 'rejected' ? 'draft' : requisition.status;
      return tx.jobRequisition.update({ where: { id }, data: { status } });
    });
  }

  async createCandidate(tenantId: string, dto: CreateCandidateDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const requisition = await tx.jobRequisition.findUniqueOrThrow({ where: { id: dto.requisitionId } });
      if (requisition.status !== 'open') {
        throw AppErrors.badRequest('REQUISITION_NOT_APPROVED', "Cannot add candidates to a requisition that isn't open");
      }
      return tx.candidate.create({
        data: {
          tenantId, requisitionId: dto.requisitionId, name: dto.name, email: dto.email, phone: dto.phone,
          resumeUrl: dto.resumeUrl, source: dto.source ?? 'manual', referredByEmployeeId: dto.referredByEmployeeId,
        },
      });
    });
  }

  async listCandidates(tenantId: string, requisitionId?: string) {
    return this.prisma.withTenant(tenantId, (tx) => tx.candidate.findMany({ where: { tenantId, requisitionId }, orderBy: { createdAt: 'desc' } }));
  }

  async changeStage(tenantId: string, candidateId: string, dto: StageChangeDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const candidate = await tx.candidate.findUniqueOrThrow({ where: { id: candidateId } });

      if (candidate.currentStage === 'interview' && dto.toStage === 'offer') {
        const feedback = await tx.interviewFeedback.findMany({ where: { candidateId } });
        const pending = feedback.filter((f) => f.submittedAt == null);
        if (pending.length > 0) {
          throw AppErrors.unprocessable('INCOMPLETE_SCORECARDS', `Waiting on ${pending.length} pending interview scorecards`);
        }
      }
      if (dto.toStage === 'rejected' && !dto.reason) {
        throw AppErrors.badRequest('REJECTION_REASON_REQUIRED', 'A rejection reason is required', 'reason');
      }

      return tx.candidate.update({
        where: { id: candidateId },
        data: { currentStage: dto.toStage, rejectionReason: dto.toStage === 'rejected' ? dto.reason : undefined },
      });
    });
  }

  async scheduleInterview(tenantId: string, candidateId: string, dto: ScheduleInterviewDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const scheduledAt = new Date(dto.scheduledAt);
      const rows = await Promise.all(
        dto.interviewerIds.map((interviewerId) =>
          tx.interviewFeedback.create({ data: { candidateId, interviewerId, scheduledAt, scorecard: [] } }),
        ),
      );
      await tx.candidate.updateMany({ where: { id: candidateId, currentStage: { not: 'interview' } }, data: { currentStage: 'interview' } });
      return rows;
    });
  }

  async submitScorecard(tenantId: string, feedbackId: string, dto: SubmitScorecardDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.interviewFeedback.update({
        where: { id: feedbackId },
        data: { scorecard: dto.scorecard as unknown as Prisma.InputJsonValue, recommendation: dto.recommendation, submittedAt: new Date() },
      }),
    );
  }

  async createOffer(tenantId: string, actingUser: RequestUser, dto: CreateOfferDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const candidate = await tx.candidate.findUniqueOrThrow({ where: { id: dto.candidateId } });
      const requisition = await tx.jobRequisition.findUniqueOrThrow({ where: { id: candidate.requisitionId } });

      const existingOffer = await tx.offer.findUnique({ where: { candidateId: dto.candidateId } });
      if (existingOffer && ['draft', 'sent'].includes(existingOffer.status)) {
        throw AppErrors.conflict('DUPLICATE_ACTIVE_OFFER', 'Candidate already has an active offer');
      }
      if (requisition.budgetCtcMax && dto.annualCtc > Number(requisition.budgetCtcMax) && actingUser.roleName !== SystemRole.HR_ADMIN) {
        throw AppErrors.unprocessable('OFFER_EXCEEDS_BUDGET', 'Offer exceeds the approved budget for this requisition');
      }

      return tx.offer.upsert({
        where: { candidateId: dto.candidateId },
        create: {
          candidateId: dto.candidateId, salaryStructureId: dto.salaryStructureId, annualCtc: dto.annualCtc,
          proposedDoj: new Date(dto.proposedDoj), expiryDate: new Date(Date.now() + 7 * 86_400_000),
        },
        update: {
          salaryStructureId: dto.salaryStructureId, annualCtc: dto.annualCtc, proposedDoj: new Date(dto.proposedDoj),
          status: 'draft', sentAt: null, respondedAt: null, esignReference: null,
        },
      });
    });
  }

  async sendOffer(tenantId: string, offerId: string, dto: SendOfferDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.offer.update({
        where: { id: offerId },
        data: {
          status: 'sent', sentAt: new Date(),
          expiryDate: new Date(Date.now() + (dto.expiryDays ?? 7) * 86_400_000),
          esignReference: `stub-esign-${offerId}`, // no real e-sign provider wired up
        },
      }),
    );
  }

  async acceptOffer(tenantId: string, offerId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const offer = await tx.offer.findUniqueOrThrow({ where: { id: offerId } });
      if (offer.status === 'accepted') return offer; // idempotent — retry-safe

      const candidate = await tx.candidate.findUniqueOrThrow({ where: { id: offer.candidateId } });
      const updated = await tx.offer.update({ where: { id: offerId }, data: { status: 'accepted', respondedAt: new Date() } });

      if (!candidate.hiredEmployeeId) {
        const [firstName, ...rest] = candidate.name.split(' ');
        const requisition = await tx.jobRequisition.findUniqueOrThrow({ where: { id: candidate.requisitionId } });
        const employee = await this.employees.createPreBoarding(tx, {
          tenantId, firstName, lastName: rest.join(' ') || undefined, personalEmail: candidate.email ?? undefined,
          phone: candidate.phone ?? undefined, departmentId: requisition.departmentId,
          dateOfJoining: offer.proposedDoj, employmentType: requisition.employmentType,
        });
        await tx.candidate.update({ where: { id: candidate.id }, data: { currentStage: 'hired', hiredEmployeeId: employee.id } });
      }
      return updated;
    });
  }

  async declineOffer(tenantId: string, offerId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const offer = await tx.offer.update({ where: { id: offerId }, data: { status: 'declined', respondedAt: new Date() } });
      await tx.candidate.update({ where: { id: offer.candidateId }, data: { currentStage: 'rejected', rejectionReason: 'offer_declined' } });
      return offer;
    });
  }

  /** Daily expiry sweep — auto-rejects candidates whose offer expired unresponded (spec acceptance criteria). */
  @Cron('30 2 * * *')
  async expireStaleOffers() {
    await this.prisma.withoutTenantScope(async (tx) => {
      const expired = await tx.offer.findMany({ where: { status: 'sent', expiryDate: { lt: new Date() } } });
      for (const offer of expired) {
        await tx.offer.update({ where: { id: offer.id }, data: { status: 'expired' } });
        await tx.candidate.update({
          where: { id: offer.candidateId },
          data: { currentStage: 'rejected' as CandidateStage, rejectionReason: 'offer_expired' },
        });
      }
    });
  }
}
