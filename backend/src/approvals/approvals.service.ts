import { Injectable } from '@nestjs/common';
import { ApprovalApplicability, Prisma } from '@prisma/client';
import { AppErrors } from '../common/errors/app-error';
import { DelegationsService } from '../delegations/delegations.service';

type Tx = Prisma.TransactionClient;

interface ApprovalStepConfig {
  approverType: 'manager' | 'role' | 'specific_user';
  roleId?: string;
  userId?: string;
  escalationHours?: number;
}

interface ResolvedStepEntry {
  step: number;
  approverType: string;
  resolvedApproverEmployeeId: string | null;
  resolvedApproverUserId: string | null;
  resolvedApproverRoleId: string | null;
  escalated: boolean;
  decidedByUserId: string | null;
  decision: 'approve' | 'reject' | null;
  comment: string | null;
  decidedAt: string | null;
}

/**
 * Shared primitive consumed by Leave, Attendance (regularization), Recruitment
 * (requisitions), and Payroll (loan/advance) — per the Engineering Specification's
 * module map, none of those modules re-specify chain execution themselves.
 *
 * Design note: ApprovalInstance itself has no employee_id column (per spec), so
 * "who is the assigned approver" for a manager-type step can't be re-derived
 * later if the employee's manager changes mid-flight. To avoid that drift, all
 * steps' approvers are resolved ONCE at instance-creation time and frozen into
 * stepHistory — the same "snapshot" pattern the Attendance spec uses for
 * shift_policy_id on AttendanceRecord.
 */
@Injectable()
export class ApprovalsService {
  constructor(private readonly delegations: DelegationsService) {}

  async createInstance(
    tx: Tx,
    params: { tenantId: string; applicability: ApprovalApplicability; subjectEmployeeId: string },
  ) {
    const chain = await tx.approvalChain.findFirst({
      where: { tenantId: params.tenantId, appliesTo: params.applicability, isActive: true },
    });
    if (!chain) {
      throw AppErrors.badRequest(
        'NO_APPROVAL_CHAIN_CONFIGURED',
        `No active approval chain configured for ${params.applicability}`,
      );
    }

    const steps = chain.steps as unknown as ApprovalStepConfig[];
    const resolved: ResolvedStepEntry[] = [];
    for (let i = 0; i < steps.length; i++) {
      resolved.push(await this.resolveStep(tx, params.tenantId, i, steps[i], params.subjectEmployeeId));
    }

    const instance = await tx.approvalInstance.create({
      data: {
        tenantId: params.tenantId,
        approvalChainId: chain.id,
        currentStep: 0,
        status: 'pending',
        stepHistory: resolved as unknown as Prisma.InputJsonValue,
      },
    });

    return { instance, currentApprover: await this.describeApprover(tx, resolved[0]) };
  }

  async decide(
    tx: Tx,
    instanceId: string,
    actingUser: { userId: string; employeeId: string | null; roleId: string },
    decision: 'approve' | 'reject',
    comment?: string,
  ) {
    const instance = await tx.approvalInstance.findUnique({ where: { id: instanceId } });
    if (!instance) {
      throw AppErrors.notFound('APPROVAL_INSTANCE_NOT_FOUND', 'Approval instance not found');
    }
    if (instance.status !== 'pending') {
      throw AppErrors.conflict('ALREADY_DECIDED', 'This approval step has already been decided');
    }

    const stepHistory = instance.stepHistory as unknown as ResolvedStepEntry[];
    const current = stepHistory[instance.currentStep];
    if (!current) {
      throw AppErrors.conflict('ALREADY_DECIDED', 'This approval instance has no pending step');
    }

    const isAssigned = await this.matchesApprover(tx, instance.tenantId, current, actingUser);
    if (!isAssigned) {
      throw AppErrors.forbidden('NOT_ASSIGNED_APPROVER', 'You are not the assigned approver for this step');
    }

    current.decidedByUserId = actingUser.userId;
    current.decision = decision;
    current.comment = comment ?? null;
    current.decidedAt = new Date().toISOString();

    const isLastStep = instance.currentStep === stepHistory.length - 1;
    const nextStatus = decision === 'reject' ? 'rejected' : isLastStep ? 'approved' : 'pending';
    const nextStep = decision === 'approve' && !isLastStep ? instance.currentStep + 1 : instance.currentStep;

    const result = await tx.approvalInstance.updateMany({
      where: { id: instanceId, status: 'pending', currentStep: instance.currentStep },
      data: { status: nextStatus, currentStep: nextStep, stepHistory: stepHistory as unknown as Prisma.InputJsonValue },
    });
    if (result.count === 0) {
      // Someone else decided this step between our read and write.
      throw AppErrors.conflict('ALREADY_DECIDED', 'This approval step has already been decided');
    }

    const updated = await tx.approvalInstance.findUniqueOrThrow({ where: { id: instanceId } });
    const nextHistory = updated.stepHistory as unknown as ResolvedStepEntry[];
    const nextApprover = updated.status === 'pending' ? await this.describeApprover(tx, nextHistory[updated.currentStep]) : null;
    return { instance: updated, nextApprover };
  }

  async isAssignedApprover(
    tx: Tx,
    instanceId: string,
    actingUser: { userId: string; employeeId: string | null; roleId: string },
  ): Promise<boolean> {
    const instance = await tx.approvalInstance.findUnique({ where: { id: instanceId } });
    if (!instance || instance.status !== 'pending') return false;
    const stepHistory = instance.stepHistory as unknown as ResolvedStepEntry[];
    const current = stepHistory[instance.currentStep];
    return this.matchesApprover(tx, instance.tenantId, current, actingUser);
  }

  /**
   * True if actingUser is the step's assigned approver directly, OR is an
   * active delegate for that approver (see Delegation model / DelegationsService
   * — "while I'm on leave, let X handle my approvals"). Checked live, at
   * decision time, not frozen when the instance was created, so a delegation
   * set up after submission still lets the delegate act. Role-type steps don't
   * consult delegation — a role already lets any holder of that role act, so
   * there's no single person to delegate away from.
   */
  private async matchesApprover(
    tx: Tx,
    tenantId: string,
    current: ResolvedStepEntry,
    actingUser: { userId: string; employeeId: string | null; roleId: string },
  ): Promise<boolean> {
    const directMatch =
      (current.approverType === 'manager' && current.resolvedApproverEmployeeId === actingUser.employeeId) ||
      (current.approverType === 'specific_user' && current.resolvedApproverUserId === actingUser.userId) ||
      (current.approverType === 'role' && current.resolvedApproverRoleId === actingUser.roleId);
    if (directMatch) return true;

    if (current.resolvedApproverEmployeeId && actingUser.employeeId) {
      const delegate = await this.delegations.getActiveDelegate(tx, tenantId, current.resolvedApproverEmployeeId, new Date());
      if (delegate === actingUser.employeeId) return true;
    }
    return false;
  }

  /** Hourly escalation sweep (Leave spec §6.3) — reassigns overdue steps to the tenant's HR Admin. */
  async escalateOverdueSteps(tx: Tx, tenantId: string) {
    const pending = await tx.approvalInstance.findMany({
      where: { tenantId, status: 'pending' },
      include: { chain: true },
    });
    let escalatedCount = 0;
    for (const instance of pending) {
      const steps = instance.chain.steps as unknown as ApprovalStepConfig[];
      const stepConfig = steps[instance.currentStep];
      const escalationHours = stepConfig?.escalationHours;
      if (!escalationHours) continue;

      const stepHistory = instance.stepHistory as unknown as ResolvedStepEntry[];
      const current = stepHistory[instance.currentStep];
      if (current.escalated) continue;

      const ageHours = (Date.now() - instance.updatedAt.getTime()) / 3_600_000;
      if (ageHours < escalationHours) continue;

      const fallback = await tx.user.findFirst({ where: { tenantId, role: { name: 'HR Admin' } } });
      if (!fallback) continue;

      current.escalated = true;
      current.resolvedApproverUserId = fallback.id;
      current.resolvedApproverEmployeeId = fallback.employeeId;
      current.approverType = 'specific_user';

      await tx.approvalInstance.update({
        where: { id: instance.id },
        data: { stepHistory: stepHistory as unknown as Prisma.InputJsonValue },
      });
      escalatedCount++;
    }
    return escalatedCount;
  }

  private async resolveStep(
    tx: Tx,
    tenantId: string,
    stepIndex: number,
    step: ApprovalStepConfig,
    subjectEmployeeId: string,
  ): Promise<ResolvedStepEntry> {
    const base: ResolvedStepEntry = {
      step: stepIndex,
      approverType: step.approverType,
      resolvedApproverEmployeeId: null,
      resolvedApproverUserId: null,
      resolvedApproverRoleId: null,
      escalated: false,
      decidedByUserId: null,
      decision: null,
      comment: null,
      decidedAt: null,
    };

    if (step.approverType === 'manager') {
      const employee = await tx.employee.findUnique({ where: { id: subjectEmployeeId } });
      let managerId = employee?.managerId ?? null;
      if (!managerId) {
        // No manager on file (top of hierarchy) — fall back to any HR Admin, per
        // the same fallback-approver pattern the spec uses for escalation.
        const hrAdmin = await tx.user.findFirst({ where: { tenantId, role: { name: 'HR Admin' } } });
        base.resolvedApproverUserId = hrAdmin?.id ?? null;
        base.resolvedApproverEmployeeId = hrAdmin?.employeeId ?? null;
        base.approverType = 'specific_user';
        return base;
      }
      base.resolvedApproverEmployeeId = managerId;
      return base;
    }

    if (step.approverType === 'role' && step.roleId) {
      base.resolvedApproverRoleId = step.roleId;
      return base;
    }

    if (step.approverType === 'specific_user' && step.userId) {
      base.resolvedApproverUserId = step.userId;
      const user = await tx.user.findUnique({ where: { id: step.userId } });
      base.resolvedApproverEmployeeId = user?.employeeId ?? null;
      return base;
    }

    return base;
  }

  private async describeApprover(tx: Tx, entry: ResolvedStepEntry) {
    if (entry.resolvedApproverEmployeeId) {
      const employee = await tx.employee.findUnique({ where: { id: entry.resolvedApproverEmployeeId } });
      if (employee) {
        return { employeeId: employee.id, name: `${employee.firstName} ${employee.lastName ?? ''}`.trim() };
      }
    }
    if (entry.resolvedApproverRoleId) {
      return { roleId: entry.resolvedApproverRoleId, name: '(any user with this role)' };
    }
    return null;
  }
}
