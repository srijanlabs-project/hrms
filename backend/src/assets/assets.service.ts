import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppErrors } from '../common/errors/app-error';
import { CreateAssetDto, AllocateAssetDto, ReturnAssetDto } from './dto/assets.dto';

type Tx = Prisma.TransactionClient;

interface AccessItem {
  system: string;
  action: 'grant' | 'revoke';
  status: 'pending' | 'done';
}

// Postgres unique-violation error code, used to translate the DB-level
// asset_allocations_active_unique partial index violation into a clean AppError
// instead of letting a raw Prisma/Postgres error reach the client.
const POSTGRES_UNIQUE_VIOLATION = 'P2002';

function placeholderAccessItems(action: 'grant' | 'revoke'): AccessItem[] {
  // No real IT-system integration exists yet (spec calls these "small reasonable
  // placeholder accessItems") — Email + HRMS Portal are the two systems every
  // employee needs on day one / loses on exit. A real provisioning integration
  // would replace this with a per-tenant configurable list.
  return [
    { system: 'Email', action, status: 'pending' },
    { system: 'HRMS Portal', action, status: 'pending' },
  ];
}

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createAsset(tenantId: string, dto: CreateAssetDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.asset.create({
        data: {
          tenantId,
          assetTag: dto.assetTag,
          type: dto.type,
          makeModel: dto.makeModel,
          serialNumber: dto.serialNumber,
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
          purchaseValue: dto.purchaseValue,
        },
      }),
    );
  }

  async listAssets(tenantId: string, status?: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.asset.findMany({
        where: { tenantId, status: status as never },
        include: { allocations: { where: { returnedOn: null } } },
        orderBy: { assetTag: 'asc' },
      }),
    );
  }

  async allocate(tenantId: string, assetId: string, dto: AllocateAssetDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const asset = await tx.asset.findUnique({ where: { id: assetId } });
      if (!asset) throw AppErrors.notFound('ASSET_NOT_FOUND', 'Asset not found');
      // Proactive check before hitting the DB — the partial unique index
      // (asset_id) WHERE returned_on IS NULL is the real backstop, caught below.
      if (asset.status !== 'in_stock') {
        throw AppErrors.conflict('ASSET_ALREADY_ALLOCATED', 'This asset is not available for allocation');
      }

      try {
        const allocation = await tx.assetAllocation.create({
          data: {
            tenantId,
            assetId,
            employeeId: dto.employeeId,
            allocatedOn: dto.allocatedOn ? new Date(dto.allocatedOn) : new Date(),
            expectedReturnOn: dto.expectedReturnOn ? new Date(dto.expectedReturnOn) : null,
          },
        });
        await tx.asset.update({ where: { id: assetId }, data: { status: 'allocated' } });
        return allocation;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === POSTGRES_UNIQUE_VIOLATION) {
          throw AppErrors.conflict('ASSET_ALREADY_ALLOCATED', 'This asset is not available for allocation');
        }
        throw err;
      }
    });
  }

  async returnAsset(tenantId: string, assetId: string, dto: ReturnAssetDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const allocation = await tx.assetAllocation.findFirst({ where: { assetId, returnedOn: null } });
      if (!allocation) {
        throw AppErrors.badRequest('RETURN_WITHOUT_ALLOCATION', 'This asset has no active allocation to return');
      }
      const updated = await tx.assetAllocation.update({
        where: { id: allocation.id },
        data: {
          returnedOn: dto.returnedOn ? new Date(dto.returnedOn) : new Date(),
          conditionOnReturn: dto.conditionOnReturn,
        },
      });
      await tx.asset.update({
        where: { id: assetId },
        data: { status: dto.conditionOnReturn === 'damaged' ? 'under_repair' : 'in_stock' },
      });
      return updated;
    });
  }

  async getEmployeeAssets(tenantId: string, employeeId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.assetAllocation.findMany({
        where: { employeeId },
        include: { asset: true },
        orderBy: { allocatedOn: 'desc' },
      }),
    );
  }

  /** Used by the Exit module for the 'it' clearance task's informational context. */
  async getUnreturnedAssetsForExitedEmployee(tenantId: string, employeeId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.assetAllocation.findMany({
        where: { employeeId, returnedOn: null },
        include: { asset: true },
      }),
    );
  }

  async listItAccessRequests(tenantId: string, employeeId?: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.itAccessRequest.findMany({
        where: { tenantId, employeeId },
        orderBy: { id: 'desc' },
      }),
    );
  }

  async completeAccessItem(tenantId: string, requestId: string, itemIndex: number) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const request = await tx.itAccessRequest.findUnique({ where: { id: requestId } });
      if (!request) throw AppErrors.notFound('IT_ACCESS_REQUEST_NOT_FOUND', 'IT access request not found');

      const items = (request.accessItems as unknown as AccessItem[]) ?? [];
      if (itemIndex < 0 || itemIndex >= items.length) {
        throw AppErrors.badRequest('INVALID_ITEM_INDEX', 'No access item at that index', 'itemIndex');
      }
      items[itemIndex] = { ...items[itemIndex], status: 'done' };
      const allDone = items.every((i) => i.status === 'done');

      return tx.itAccessRequest.update({
        where: { id: requestId },
        data: {
          accessItems: items as unknown as Prisma.InputJsonValue,
          status: allDone ? 'completed' : 'in_progress',
          completedAt: allDone ? new Date() : null,
        },
      });
    });
  }

  private async createAccessRequest(
    tx: Tx,
    tenantId: string,
    employeeId: string,
    trigger: 'joining' | 'department_transfer' | 'exit',
    action: 'grant' | 'revoke',
  ) {
    return tx.itAccessRequest.create({
      data: {
        tenantId,
        employeeId,
        triggerEvent: trigger,
        accessItems: placeholderAccessItems(action) as unknown as Prisma.InputJsonValue,
        status: 'pending',
      },
    });
  }

  // Event listeners below fire outside HTTP request context (background job /
  // internal service call), so tenantId/employeeId come from the event payload,
  // never @CurrentUser.

  @OnEvent('employee.joined')
  async onEmployeeJoined(payload: { tenantId: string; employeeId: string }) {
    try {
      await this.prisma.withTenant(payload.tenantId, (tx) =>
        this.createAccessRequest(tx, payload.tenantId, payload.employeeId, 'joining', 'grant'),
      );
    } catch (err) {
      this.logger.error(`Failed to create joining IT access request for employee ${payload.employeeId}`, err as Error);
    }
  }

  @OnEvent('employee.department_transferred')
  async onEmployeeDepartmentTransferred(payload: { tenantId: string; employeeId: string }) {
    try {
      await this.prisma.withTenant(payload.tenantId, (tx) =>
        this.createAccessRequest(tx, payload.tenantId, payload.employeeId, 'department_transfer', 'grant'),
      );
    } catch (err) {
      this.logger.error(`Failed to create transfer IT access request for employee ${payload.employeeId}`, err as Error);
    }
  }

  @OnEvent('employee.exited')
  async onEmployeeExited(payload: { tenantId: string; employeeId: string }) {
    try {
      await this.prisma.withTenant(payload.tenantId, (tx) =>
        this.createAccessRequest(tx, payload.tenantId, payload.employeeId, 'exit', 'revoke'),
      );
    } catch (err) {
      this.logger.error(`Failed to create exit IT access request for employee ${payload.employeeId}`, err as Error);
    }
  }
}
