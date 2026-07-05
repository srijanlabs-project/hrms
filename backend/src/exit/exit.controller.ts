import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ExitService } from './exit.service';
import { CreateExitRequestDto, UpdateLastWorkingDayDto, UpdateClearanceTaskDto, SubmitExitInterviewDto } from './dto/exit.dto';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/request-user';
import { Roles } from '../common/auth/roles.decorator';
import { SystemRole } from '../common/auth/roles.enum';

@Controller('api/v1')
export class ExitController {
  constructor(private readonly exit: ExitService) {}

  @Post('exit-requests')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateExitRequestDto) {
    return this.exit.createExitRequest(user.tenantId!, dto);
  }

  @Get('exit-requests')
  list(@CurrentUser() user: RequestUser, @Query('employeeId') employeeId?: string) {
    return this.exit.listExitRequests(user.tenantId!, employeeId);
  }

  @Roles(SystemRole.HR_ADMIN)
  @Patch('exit-requests/:id/last-working-day')
  updateLastWorkingDay(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateLastWorkingDayDto) {
    return this.exit.updateLastWorkingDay(user.tenantId!, id, user.userId, dto);
  }

  @Roles(SystemRole.HR_ADMIN)
  @Post('exit-requests/:id/start-clearance')
  startClearance(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.exit.startClearance(user.tenantId!, id);
  }

  @Post('exit-requests/:id/withdraw')
  withdraw(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.exit.withdraw(user.tenantId!, id);
  }

  @Patch('clearance-tasks/:id')
  updateClearanceTask(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateClearanceTaskDto) {
    return this.exit.updateClearanceTask(user.tenantId!, id, dto);
  }

  @Post('exit-interviews/:exitRequestId/submit')
  submitExitInterview(
    @CurrentUser() user: RequestUser,
    @Param('exitRequestId') exitRequestId: string,
    @Body() dto: SubmitExitInterviewDto,
  ) {
    return this.exit.submitExitInterview(user.tenantId!, exitRequestId, dto);
  }
}
