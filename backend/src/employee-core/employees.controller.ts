import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/request-user';
import { Roles } from '../common/auth/roles.decorator';
import { SystemRole } from '../common/auth/roles.enum';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('api/v1')
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('employees')
  list(
    @CurrentUser() user: RequestUser,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: EmploymentStatus,
    @Query('managerId') managerId?: string,
  ) {
    return this.employees.list(user.tenantId!, { departmentId, status, managerId });
  }

  @Roles(SystemRole.HR_ADMIN)
  @Post('employees')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(user.tenantId!, dto);
  }

  @Get('employees/:id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.employees.findOne(user.tenantId!, id);
  }

  @Patch('employees/:id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(user.tenantId!, id, dto);
  }

  @Post('employees/:id/documents')
  addDocument(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: AddDocumentDto) {
    return this.prisma.withTenant(user.tenantId!, (tx) =>
      tx.document.create({
        data: {
          tenantId: user.tenantId!,
          employeeId: id,
          docType: dto.docType,
          fileUrl: dto.fileUrl,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        },
      }),
    );
  }

  @Get('departments')
  listDepartments(@CurrentUser() user: RequestUser) {
    return this.prisma.withTenant(user.tenantId!, (tx) => tx.department.findMany({ where: { tenantId: user.tenantId! } }));
  }

  @Get('org-chart')
  orgChart(@CurrentUser() user: RequestUser) {
    return this.employees.orgChart(user.tenantId!);
  }
}
