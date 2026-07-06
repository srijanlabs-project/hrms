import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppErrors } from '../common/errors/app-error';
import { CreateDelegationDto } from './dto/create-delegation.dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class DelegationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, delegatorEmployeeId: string, dto: CreateDelegationDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw AppErrors.badRequest('INVALID_RANGE', 'endDate must be on or after startDate', 'endDate');
    }
    if (dto.delegateEmployeeId === delegatorEmployeeId) {
      throw AppErrors.badRequest('CANNOT_DELEGATE_TO_SELF', 'You cannot delegate to yourself');
    }
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.delegation.create({
        data: { tenantId, delegatorEmployeeId, delegateEmployeeId: dto.delegateEmployeeId, startDate, endDate, reason: dto.reason },
      }),
    );
  }

  /** Delegations the employee has given, and ones they've received. */
  async listForEmployee(tenantId: string, employeeId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const [given, received] = await Promise.all([
        tx.delegation.findMany({ where: { tenantId, delegatorEmployeeId: employeeId }, orderBy: { startDate: 'desc' } }),
        tx.delegation.findMany({ where: { tenantId, delegateEmployeeId: employeeId }, orderBy: { startDate: 'desc' } }),
      ]);
      const employeeIds = [...new Set([...given.map((d) => d.delegateEmployeeId), ...received.map((d) => d.delegatorEmployeeId)])];
      const employees = await tx.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, firstName: true, lastName: true } });
      const byId = new Map(employees.map((e) => [e.id, e]));
      return {
        given: given.map((d) => ({ ...d, delegate: byId.get(d.delegateEmployeeId) ?? null })),
        received: received.map((d) => ({ ...d, delegator: byId.get(d.delegatorEmployeeId) ?? null })),
      };
    });
  }

  async revoke(tenantId: string, id: string, actorEmployeeId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const delegation = await tx.delegation.findUnique({ where: { id } });
      if (!delegation) throw AppErrors.notFound('DELEGATION_NOT_FOUND', 'Delegation not found');
      if (delegation.delegatorEmployeeId !== actorEmployeeId) {
        throw AppErrors.forbidden('NOT_YOUR_DELEGATION', 'Only the delegator can revoke this delegation');
      }
      return tx.delegation.update({ where: { id }, data: { revokedAt: new Date() } });
    });
  }

  /**
   * Used by ApprovalsService at DECISION time (not instance-creation time) —
   * see the Delegation model's doc comment in schema.prisma for why. Returns
   * the delegate's employeeId if an active, unrevoked delegation covers `on`.
   */
  async getActiveDelegate(tx: Tx, tenantId: string, delegatorEmployeeId: string, on: Date): Promise<string | null> {
    const delegation = await tx.delegation.findFirst({
      where: { tenantId, delegatorEmployeeId, revokedAt: null, startDate: { lte: on }, endDate: { gte: on } },
      orderBy: { createdAt: 'desc' },
    });
    return delegation?.delegateEmployeeId ?? null;
  }
}
