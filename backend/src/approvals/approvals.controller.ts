import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalChainDto } from './dto/create-approval-chain.dto';
import { DecisionDto } from './dto/decision.dto';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/request-user';
import { Roles } from '../common/auth/roles.decorator';
import { SystemRole } from '../common/auth/roles.enum';

@Controller('api/v1')
export class ApprovalsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
  ) {}

  @Get('approval-chains')
  listChains(@CurrentUser() user: RequestUser) {
    return this.prisma.withTenant(user.tenantId!, (tx) =>
      tx.approvalChain.findMany({ where: { tenantId: user.tenantId! } }),
    );
  }

  @Roles(SystemRole.HR_ADMIN)
  @Post('approval-chains')
  createChain(@CurrentUser() user: RequestUser, @Body() dto: CreateApprovalChainDto) {
    return this.prisma.withTenant(user.tenantId!, (tx) =>
      tx.approvalChain.create({
        data: {
          tenantId: user.tenantId!,
          name: dto.name,
          appliesTo: dto.appliesTo,
          steps: dto.steps as unknown as object[],
          isActive: dto.isActive ?? true,
        },
      }),
    );
  }

  @Get('approvals/pending')
  async pendingForMe(@CurrentUser() user: RequestUser) {
    return this.prisma.withTenant(user.tenantId!, async (tx) => {
      const pending = await tx.approvalInstance.findMany({ where: { tenantId: user.tenantId!, status: 'pending' } });
      const mine = [];
      for (const instance of pending) {
        if (await this.approvals.isAssignedApprover(tx, instance.id, user)) {
          mine.push(instance);
        }
      }
      return mine;
    });
  }

  @Patch('approvals/:instanceId/decision')
  decide(@CurrentUser() user: RequestUser, @Param('instanceId') instanceId: string, @Body() dto: DecisionDto) {
    return this.prisma.withTenant(user.tenantId!, (tx) =>
      this.approvals.decide(tx, instanceId, user, dto.decision, dto.comment),
    );
  }
}
