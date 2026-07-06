import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function lastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(monthKey(d));
  }
  return months;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(tenantId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const employees = await tx.employee.findMany({
        select: { id: true, employmentStatus: true, gender: true, departmentId: true, dateOfJoining: true, dateOfExit: true },
      });
      const departments = await tx.department.findMany({ where: { tenantId }, select: { id: true, name: true } });
      const deptById = new Map(departments.map((d) => [d.id, d.name]));

      // --- Headcount ---
      const active = employees.filter((e) => e.employmentStatus === 'active').length;
      const onNotice = employees.filter((e) => e.employmentStatus === 'on_notice').length;
      const preBoarding = employees.filter((e) => e.employmentStatus === 'pre_boarding').length;
      const exited = employees.filter((e) => e.employmentStatus === 'exited').length;
      const byDepartment = new Map<string, number>();
      for (const e of employees) {
        if (e.employmentStatus === 'exited') continue;
        const name = (e.departmentId && deptById.get(e.departmentId)) || 'Unassigned';
        byDepartment.set(name, (byDepartment.get(name) ?? 0) + 1);
      }

      // --- Headcount trend + attrition, last 12 months ---
      const months = lastNMonths(12);
      const headcountTrend = months.map((month) => {
        const joined = employees.filter((e) => monthKey(e.dateOfJoining) === month).length;
        const exitedThisMonth = employees.filter((e) => e.dateOfExit && monthKey(e.dateOfExit) === month).length;
        return { month, joined, exited: exitedThisMonth };
      });
      const totalExitsIn12mo = headcountTrend.reduce((sum, m) => sum + m.exited, 0);
      const avgHeadcount = employees.filter((e) => e.employmentStatus !== 'pre_boarding').length || 1;
      const attritionRatePercent = Math.round((totalExitsIn12mo / avgHeadcount) * 1000) / 10;

      // --- Gender diversity ---
      const genderCounts = new Map<string, number>();
      for (const e of employees) {
        if (e.employmentStatus === 'exited') continue;
        const g = e.gender ?? 'unspecified';
        genderCounts.set(g, (genderCounts.get(g) ?? 0) + 1);
      }

      // --- Attendance rate, this month ---
      const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
      const attendanceRecords = await tx.attendanceRecord.findMany({
        where: { tenantId, date: { gte: monthStart } },
        select: { status: true },
      });
      const workingDayRecords = attendanceRecords.filter((r) => !['holiday', 'week_off'].includes(r.status));
      const presentRecords = workingDayRecords.filter((r) => r.status === 'present').length;
      const attendanceRatePercent = workingDayRecords.length > 0 ? Math.round((presentRecords / workingDayRecords.length) * 1000) / 10 : null;

      // --- Leave trend, last 6 months ---
      const last6Months = lastNMonths(6);
      const leaveRequests = await tx.leaveRequest.findMany({
        where: { tenantId, status: 'approved' },
        select: { startDate: true, totalDays: true },
      });
      const leaveTrend = last6Months.map((month) => {
        const days = leaveRequests.filter((r) => monthKey(r.startDate) === month).reduce((sum, r) => sum + Number(r.totalDays), 0);
        return { month, days };
      });

      // --- Payroll cost trend, last 6 months ---
      const payrollRuns = await tx.payrollRun.findMany({
        where: { tenantId, runType: 'regular', status: { in: ['approved', 'disbursed', 'closed'] } },
        select: { period: true, totalNet: true },
      });
      const payrollTrend = last6Months.map((month) => {
        const run = payrollRuns.find((r) => r.period === month);
        return { month, totalNet: run ? Number(run.totalNet) : 0 };
      });

      // --- Recruitment funnel ---
      const candidates = await tx.candidate.groupBy({ by: ['currentStage'], where: { tenantId }, _count: true });
      const recruitmentFunnel = candidates.map((c) => ({ stage: c.currentStage, count: c._count }));

      return {
        headcount: { total: employees.length, active, onNotice, preBoarding, exited, byDepartment: [...byDepartment.entries()].map(([name, count]) => ({ name, count })) },
        headcountTrend,
        attritionRatePercent,
        genderDiversity: [...genderCounts.entries()].map(([gender, count]) => ({ gender, count })),
        attendanceRatePercent,
        leaveTrend,
        payrollTrend,
        recruitmentFunnel,
      };
    });
  }
}
