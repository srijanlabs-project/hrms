import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppErrors } from '../common/errors/app-error';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async list(tenantId: string, filters: { departmentId?: string; status?: EmploymentStatus; managerId?: string }) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.employee.findMany({
        where: {
          tenantId,
          departmentId: filters.departmentId,
          employmentStatus: filters.status,
          managerId: filters.managerId,
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { id },
        include: { department: true, designation: true, workLocation: true, manager: true, documents: true, bankAccount: true },
      });
      if (!employee) throw AppErrors.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
      return employee;
    });
  }

  async create(tenantId: string, dto: CreateEmployeeDto) {
    const employee = await this.prisma.withTenant(tenantId, async (tx) => {
      const [existingPan, existingAadhaar] = await Promise.all([
        tx.employee.findUnique({ where: { panNumber: dto.panNumber } }),
        tx.employee.findUnique({ where: { aadhaarNumber: dto.aadhaarNumber } }),
      ]);
      if (existingPan) throw AppErrors.conflict('DUPLICATE_PAN', 'An employee with this PAN already exists');
      if (existingAadhaar) throw AppErrors.conflict('DUPLICATE_AADHAAR', 'An employee with this Aadhaar number already exists');

      return tx.employee.create({
        data: {
          tenantId,
          employeeCode: dto.employeeCode,
          firstName: dto.firstName,
          lastName: dto.lastName,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          gender: dto.gender,
          personalEmail: dto.personalEmail,
          phone: dto.phone,
          panNumber: dto.panNumber,
          aadhaarNumber: dto.aadhaarNumber,
          departmentId: dto.departmentId,
          designationId: dto.designationId,
          managerId: dto.managerId,
          dateOfJoining: new Date(dto.dateOfJoining),
          employmentType: dto.employmentType,
          workLocationId: dto.workLocationId,
          employmentStatus: new Date(dto.dateOfJoining) <= new Date() ? 'active' : 'pre_boarding',
        },
      });
    });
    if (employee.employmentStatus === 'active') {
      this.events.emit('employee.joined', { tenantId, employeeId: employee.id, departmentId: employee.departmentId });
    }
    return employee;
  }

  /** Used internally by the Recruitment module's hire handoff (spec §5) — never exposed as a public endpoint. */
  async createPreBoarding(
    tx: Tx,
    params: {
      tenantId: string;
      firstName: string;
      lastName?: string;
      personalEmail?: string;
      phone?: string;
      departmentId: string;
      designationId?: string;
      dateOfJoining: Date;
      employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
    },
  ) {
    const employeeCode = `EMP-${Date.now().toString(36).toUpperCase()}`;
    return tx.employee.create({
      data: {
        tenantId: params.tenantId,
        employeeCode,
        firstName: params.firstName,
        lastName: params.lastName,
        personalEmail: params.personalEmail,
        phone: params.phone,
        departmentId: params.departmentId,
        designationId: params.designationId,
        dateOfJoining: params.dateOfJoining,
        employmentType: params.employmentType,
        employmentStatus: 'pre_boarding',
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeDto) {
    const updated = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.employee.findUnique({ where: { id } });
      if (!existing) throw AppErrors.notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');

      const employee = await tx.employee.update({
        where: { id },
        data: {
          employeeCode: dto.employeeCode,
          firstName: dto.firstName,
          lastName: dto.lastName,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          gender: dto.gender,
          personalEmail: dto.personalEmail,
          phone: dto.phone,
          panNumber: dto.panNumber,
          aadhaarNumber: dto.aadhaarNumber,
          departmentId: dto.departmentId,
          designationId: dto.designationId,
          managerId: dto.managerId,
          dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : undefined,
          employmentType: dto.employmentType,
          workLocationId: dto.workLocationId,
        },
      });

      if (dto.departmentId && dto.departmentId !== existing.departmentId) {
        this.events.emit('employee.department_transferred', {
          tenantId,
          employeeId: id,
          oldDepartmentId: existing.departmentId,
          newDepartmentId: dto.departmentId,
        });
      }
      return employee;
    });
    return updated;
  }

  /** Used by Exit Management (on_notice/exited) and Leave (on_leave_extended) — see their module specs. */
  async setEmploymentStatus(tx: Tx, tenantId: string, employeeId: string, status: EmploymentStatus) {
    const employee = await tx.employee.update({
      where: { id: employeeId },
      data: { employmentStatus: status, dateOfExit: status === 'exited' ? new Date() : undefined },
    });
    if (status === 'exited') {
      this.events.emit('employee.exited', { tenantId, employeeId });
    }
    return employee;
  }

  async orgChart(tenantId: string) {
    const employees = await this.prisma.withTenant(tenantId, (tx) =>
      tx.employee.findMany({
        where: { tenantId, employmentStatus: { not: 'exited' } },
        select: { id: true, firstName: true, lastName: true, managerId: true, designationId: true },
      }),
    );
    const byManager = new Map<string | null, typeof employees>();
    for (const e of employees) {
      const key = e.managerId ?? null;
      if (!byManager.has(key)) byManager.set(key, []);
      byManager.get(key)!.push(e);
    }
    const build = (managerId: string | null): unknown[] =>
      (byManager.get(managerId) ?? []).map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName ?? ''}`.trim(),
        reports: build(e.id),
      }));
    return build(null);
  }
}
