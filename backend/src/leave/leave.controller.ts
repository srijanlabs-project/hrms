import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/request-user';
import { Roles } from '../common/auth/roles.decorator';
import { SystemRole } from '../common/auth/roles.enum';
import { DecisionDto } from '../approvals/dto/decision.dto';

@Controller('api/v1')
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get('leave-types')
  listTypes(@CurrentUser() user: RequestUser) {
    return this.leave.listLeaveTypes(user.tenantId!);
  }

  @Roles(SystemRole.HR_ADMIN)
  @Post('leave-types')
  createType(@CurrentUser() user: RequestUser, @Body() dto: CreateLeaveTypeDto) {
    return this.leave.createLeaveType(user.tenantId!, dto);
  }

  @Get('leave-balances/:employeeId')
  balances(@CurrentUser() user: RequestUser, @Param('employeeId') employeeId: string) {
    return this.leave.getBalances(user.tenantId!, employeeId);
  }

  @Post('leave-requests')
  apply(@CurrentUser() user: RequestUser, @Body() dto: ApplyLeaveDto) {
    return this.leave.applyLeave(user.tenantId!, user, dto);
  }

  @Get('leave-requests')
  list(
    @CurrentUser() user: RequestUser,
    @Query('employeeId') employeeId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('from') from: string | undefined,
  ) {
    return this.leave.list(user.tenantId!, { employeeId: employeeId ?? user.employeeId ?? undefined, status, from });
  }

  @Patch('leave-requests/:id/decision')
  decide(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.leave.decide(user.tenantId!, id, user, dto.decision, dto.comment);
  }

  @Post('leave-requests/:id/cancel')
  cancel(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.leave.cancel(user.tenantId!, user.employeeId!, id);
  }
}
