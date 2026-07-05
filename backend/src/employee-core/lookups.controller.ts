import { Body, Controller, Get, Post } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/request-user';
import { Roles } from '../common/auth/roles.decorator';
import { SystemRole } from '../common/auth/roles.enum';

// Simple tenant-scoped lookup CRUD for Designation/Location/Holiday — thin by
// design, these are low-complexity config tables, not a spec'd module of their own.
@Controller('api/v1')
export class LookupsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('designations')
  listDesignations(@CurrentUser() user: RequestUser) {
    return this.prisma.withTenant(user.tenantId!, (tx) => tx.designation.findMany({ where: { tenantId: user.tenantId! } }));
  }

  @Roles(SystemRole.HR_ADMIN)
  @Post('designations')
  createDesignation(@CurrentUser() user: RequestUser, @Body() body: { name: string; noticePeriodDays?: number }) {
    return this.prisma.withTenant(user.tenantId!, (tx) =>
      tx.designation.create({ data: { tenantId: user.tenantId!, name: body.name, noticePeriodDays: body.noticePeriodDays ?? 30 } }),
    );
  }

  @Get('locations')
  listLocations(@CurrentUser() user: RequestUser) {
    return this.prisma.withTenant(user.tenantId!, (tx) => tx.location.findMany({ where: { tenantId: user.tenantId! } }));
  }

  @Roles(SystemRole.HR_ADMIN)
  @Post('locations')
  createLocation(@CurrentUser() user: RequestUser, @Body() body: { name: string; state?: string }) {
    return this.prisma.withTenant(user.tenantId!, (tx) =>
      tx.location.create({ data: { tenantId: user.tenantId!, name: body.name, state: body.state } }),
    );
  }

  @Get('holidays')
  listHolidays(@CurrentUser() user: RequestUser) {
    return this.prisma.withTenant(user.tenantId!, (tx) => tx.holiday.findMany({ where: { tenantId: user.tenantId! } }));
  }

  @Roles(SystemRole.HR_ADMIN)
  @Post('holidays')
  createHoliday(@CurrentUser() user: RequestUser, @Body() body: { locationId: string; name: string; date: string }) {
    return this.prisma.withTenant(user.tenantId!, (tx) =>
      tx.holiday.create({
        data: { tenantId: user.tenantId!, locationId: body.locationId, name: body.name, date: new Date(body.date) },
      }),
    );
  }
}
