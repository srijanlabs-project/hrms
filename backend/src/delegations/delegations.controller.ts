import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DelegationsService } from './delegations.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/request-user';
import { AppErrors } from '../common/errors/app-error';

@Controller('api/v1/delegations')
export class DelegationsController {
  constructor(private readonly delegations: DelegationsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateDelegationDto) {
    if (!user.employeeId) throw AppErrors.badRequest('NO_EMPLOYEE_RECORD', 'Your account has no linked employee record');
    return this.delegations.create(user.tenantId!, user.employeeId, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    if (!user.employeeId) return { given: [], received: [] };
    return this.delegations.listForEmployee(user.tenantId!, user.employeeId);
  }

  @Post(':id/revoke')
  revoke(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    if (!user.employeeId) throw AppErrors.badRequest('NO_EMPLOYEE_RECORD', 'Your account has no linked employee record');
    return this.delegations.revoke(user.tenantId!, id, user.employeeId);
  }
}
