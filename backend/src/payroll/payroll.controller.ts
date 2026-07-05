import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { CreateSalaryStructureDto, AssignCompensationDto, CreateRunDto, EditPayslipDto } from './dto/payroll.dto';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/request-user';
import { Roles } from '../common/auth/roles.decorator';
import { SystemRole } from '../common/auth/roles.enum';

@Controller('api/v1')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Roles(SystemRole.HR_ADMIN)
  @Post('salary-structures')
  createStructure(@CurrentUser() user: RequestUser, @Body() dto: CreateSalaryStructureDto) {
    return this.payroll.createSalaryStructure(user.tenantId!, dto.name, dto.components);
  }

  @Get('salary-structures')
  listStructures(@CurrentUser() user: RequestUser) {
    return this.payroll.listSalaryStructures(user.tenantId!);
  }

  @Roles(SystemRole.HR_ADMIN)
  @Post('employee-compensations')
  assignCompensation(@CurrentUser() user: RequestUser, @Body() dto: AssignCompensationDto) {
    return this.payroll.assignCompensation(
      user.tenantId!, dto.employeeId, dto.salaryStructureId, dto.annualCtc, dto.effectiveFrom, dto.taxRegime ?? 'new',
    );
  }

  @Roles(SystemRole.HR_ADMIN, SystemRole.FINANCE)
  @Post('payroll-runs')
  createRun(@CurrentUser() user: RequestUser, @Body() dto: CreateRunDto) {
    return this.payroll.createRun(user.tenantId!, dto.period, dto.runType ?? 'regular');
  }

  @Roles(SystemRole.HR_ADMIN)
  @Post('payroll-runs/:id/process')
  processRun(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.payroll.processRun(user.tenantId!, id);
  }

  @Get('payroll-runs/:id/variance-report')
  varianceReport(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.payroll.varianceReport(user.tenantId!, id);
  }

  @Roles(SystemRole.HR_ADMIN)
  @Post('payroll-runs/:id/payslips/:employeeId')
  editPayslip(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: EditPayslipDto,
  ) {
    return this.payroll.editPayslipLineItem(user.tenantId!, id, employeeId, user.userId, dto.lineItems, dto.comment);
  }

  // Maker-checker: requires Finance or HR Admin with payroll-approval permission per
  // spec §7.5 — the permission-level distinction (vs just the role) isn't modeled yet,
  // tracked as a fast-follow once the tenant-custom-role permissions JSONB is wired up.
  @Roles(SystemRole.HR_ADMIN, SystemRole.FINANCE)
  @Post('payroll-runs/:id/approve')
  approveRun(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.payroll.approveRun(user.tenantId!, id, user.userId);
  }

  @Roles(SystemRole.FINANCE)
  @Post('payroll-runs/:id/disburse')
  disburseRun(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.payroll.disburseRun(user.tenantId!, id);
  }

  @Roles(SystemRole.FINANCE, SystemRole.HR_ADMIN)
  @Post('payroll-runs/:id/close')
  closeRun(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.payroll.closeRun(user.tenantId!, id);
  }

  @Get('payslips/:employeeId')
  employeePayslips(@CurrentUser() user: RequestUser, @Param('employeeId') employeeId: string) {
    return this.payroll.getEmployeePayslips(user.tenantId!, employeeId);
  }
}
