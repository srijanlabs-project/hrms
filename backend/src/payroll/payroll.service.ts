import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppErrors } from '../common/errors/app-error';
import { AttendanceService } from '../attendance/attendance.service';
import { resolveComponents, ResolvedComponent } from './component-resolver';
import { computeEsi, computeGratuityAccrual, computePf, computePt, computeTds, loadStatutoryParams } from './statutory-calc';

type Tx = Prisma.TransactionClient;

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
  ) {}

  async createSalaryStructure(tenantId: string, name: string, components: unknown[]) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.salaryStructure.create({ data: { tenantId, name, components: components as Prisma.InputJsonValue } }),
    );
  }

  async listSalaryStructures(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) => tx.salaryStructure.findMany({ where: { tenantId, isActive: true } }));
  }

  async assignCompensation(tenantId: string, employeeId: string, salaryStructureId: string, annualCtc: number, effectiveFrom: string, taxRegime: 'old' | 'new') {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const structure = await tx.salaryStructure.findUniqueOrThrow({ where: { id: salaryStructureId } });
      const resolved = resolveComponents(structure.components as never, annualCtc);

      await tx.employeeCompensation.updateMany({
        where: { employeeId, effectiveTo: null },
        data: { effectiveTo: new Date(new Date(effectiveFrom).getTime() - 86_400_000) },
      });

      return tx.employeeCompensation.create({
        data: {
          tenantId,
          employeeId,
          salaryStructureId,
          annualCtc,
          effectiveFrom: new Date(effectiveFrom),
          resolvedComponents: resolved as unknown as Prisma.InputJsonValue,
          taxRegime,
        },
      });
    });
  }

  async createRun(tenantId: string, period: string, runType: 'regular' | 'full_and_final' | 'off_cycle' = 'regular') {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.payrollRun.findFirst({ where: { tenantId, period, runType } });
      if (existing) throw AppErrors.conflict('DUPLICATE_RUN', 'A run already exists for this period and runType');
      return tx.payrollRun.create({ data: { tenantId, period, runType } });
    });
  }

  /** Internal API used by Exit Management on all-clear (spec §9) — idempotent per exitRequestId. */
  async createFullAndFinalRun(tx: Tx, tenantId: string, exitRequestId: string, period: string) {
    const existing = await tx.payrollRun.findUnique({ where: { exitRequestId } });
    if (existing) return existing;
    return tx.payrollRun.create({ data: { tenantId, period, runType: 'full_and_final', exitRequestId } });
  }

  async processRun(tenantId: string, runId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const run = await tx.payrollRun.findUniqueOrThrow({ where: { id: runId } });
      if (run.status !== 'draft') throw AppErrors.conflict('INVALID_STATE', 'Only a draft run can be processed');
      await tx.payrollRun.update({ where: { id: runId }, data: { status: 'processing' } });

      const employees = await tx.employee.findMany({ where: { tenantId, employmentStatus: { in: ['active', 'on_notice'] } } });
      const blockingErrors: { employeeId: string; reason: string }[] = [];
      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;

      for (const employee of employees) {
        try {
          const result = await this.processEmployeePayslip(tx, tenantId, run, employee.id);
          if (result) {
            totalGross += result.grossEarnings;
            totalDeductions += result.totalDeductions;
            totalNet += result.netPay;
          }
        } catch (err) {
          if (err instanceof Error && 'code' in err) {
            blockingErrors.push({ employeeId: employee.id, reason: (err as unknown as { code: string }).code });
          } else {
            throw err;
          }
        }
      }

      const updated = await tx.payrollRun.update({
        where: { id: runId },
        data: { status: 'review', processedAt: new Date(), totalGross, totalDeductions, totalNet },
      });
      return { run: updated, blockingErrors };
    });
  }

  private async processEmployeePayslip(tx: Tx, tenantId: string, run: { id: string; period: string; runType: string }, employeeId: string) {
    const compensation = await tx.employeeCompensation.findFirst({
      where: { employeeId, effectiveTo: null },
    });
    if (!compensation) {
      throw Object.assign(new Error('No active compensation'), { code: 'NO_ACTIVE_COMPENSATION' });
    }

    const employee = await tx.employee.findUniqueOrThrow({ where: { id: employeeId } });
    const location = employee.workLocationId ? await tx.location.findUnique({ where: { id: employee.workLocationId } }) : null;
    const [year, month] = run.period.split('-').map(Number);
    const periodDate = new Date(Date.UTC(year, month - 1, 1));

    const aggregate = await this.attendance.getMonthlyAggregate(tenantId, employeeId, run.period);
    const components = compensation.resolvedComponents as unknown as ResolvedComponent[];
    const daysInPeriod = aggregate.daysInPeriod;

    const earningLines: { code: string; name: string; amount: number }[] = [];
    let grossEarnings = 0;
    for (const c of components.filter((c) => c.type === 'earning')) {
      const perDayRate = c.monthlyAmount / daysInPeriod;
      const amount = c.lopApplicable ? c.monthlyAmount - perDayRate * aggregate.lopDays : c.monthlyAmount;
      earningLines.push({ code: c.code, name: c.name, amount: Math.round(amount * 100) / 100 });
      grossEarnings += amount;
    }

    const basic = components.find((c) => c.code === 'BASIC')?.monthlyAmount ?? 0;
    const da = components.find((c) => c.code === 'DA')?.monthlyAmount ?? 0;

    let overtimePay = 0;
    if (aggregate.overtimeMinutes > 0) {
      const shiftPolicy = await this.attendance.resolveShiftPolicy(tx, tenantId, employee.departmentId).catch(() => null);
      const hourlyRate = basic / (daysInPeriod * 8);
      overtimePay = (aggregate.overtimeMinutes / 60) * hourlyRate * Number(shiftPolicy?.overtimeMultiplier ?? 1.5);
      overtimePay = Math.round(overtimePay * 100) / 100;
      grossEarnings += overtimePay;
    }

    const params = await loadStatutoryParams(tx, periodDate);
    const pf = computePf(basic + da, params, compensation.pfOptedOut);
    const esi = computeEsi(grossEarnings, params);
    const pt = location?.state ? await computePt(tx, location.state, grossEarnings, periodDate) : 0;
    const fiscalYear = month >= 4 ? `${year}-${String(year + 1).slice(2)}` : `${year - 1}-${String(year).slice(2)}`;
    const remainingMonths = month >= 4 ? 12 - (month - 4) : 12 - (month + 8);
    const taxableMonthly = components.filter((c) => c.taxable).reduce((s, c) => s + c.monthlyAmount, 0);
    const tds = await computeTds(tx, {
      employeeId, taxRegime: compensation.taxRegime, monthlyTaxableEarnings: taxableMonthly, fiscalYear, remainingMonthsInFiscalYear: remainingMonths,
    });
    const gratuityAccrual = computeGratuityAccrual(basic + da);

    const activeLoans = await tx.loanAdvance.findMany({ where: { employeeId, status: 'active', type: { in: ['loan', 'advance'] } } });
    let loanDeduction = 0;
    for (const loan of activeLoans) {
      if (!loan.installments) continue;
      const installmentAmount = Number(loan.amount) / loan.installments;
      loanDeduction += installmentAmount;
      const installmentsPaid = loan.installmentsPaid + 1;
      await tx.loanAdvance.update({
        where: { id: loan.id },
        data: { installmentsPaid, status: installmentsPaid >= loan.installments ? 'closed' : 'active' },
      });
    }
    const reimbursements = await tx.loanAdvance.findMany({ where: { employeeId, status: 'approved', type: 'reimbursement' } });
    const reimbursementTotal = reimbursements.reduce((s, r) => s + Number(r.amount), 0);
    if (reimbursements.length) {
      await tx.loanAdvance.updateMany({ where: { id: { in: reimbursements.map((r) => r.id) } }, data: { status: 'closed' } });
    }

    const totalDeductions = pf.pfEmployee + esi.esiEmployee + pt + tds + loanDeduction;
    const netPay = Math.round((grossEarnings - totalDeductions + reimbursementTotal) * 100) / 100;

    const lineItems = {
      earnings: earningLines,
      overtimePay,
      reimbursements: reimbursementTotal,
      deductions: { pfEmployee: pf.pfEmployee, esiEmployee: esi.esiEmployee, pt, tds, loanDeduction },
      employerContributions: { pfEmployer: pf.pfEmployer, epsEmployer: pf.epsEmployer, esiEmployer: esi.esiEmployer, gratuityAccrual },
    };

    const payslip = await tx.payslip.upsert({
      where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId } },
      create: {
        tenantId, payrollRunId: run.id, employeeId,
        grossEarnings: Math.round(grossEarnings * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        netPay,
        lopDays: aggregate.lopDays,
        overtimeMinutes: aggregate.overtimeMinutes,
        lineItems: lineItems as unknown as Prisma.InputJsonValue,
        status: netPay < 0 ? 'held' : 'generated',
      },
      update: {
        grossEarnings: Math.round(grossEarnings * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        netPay, lineItems: lineItems as unknown as Prisma.InputJsonValue,
        status: netPay < 0 ? 'held' : 'generated',
      },
    });

    await tx.statutoryDeduction.deleteMany({ where: { payslipId: payslip.id } });
    const deductionRows: { type: string; amount: number; basis: object }[] = [
      { type: 'pf_employee', amount: pf.pfEmployee, basis: { pfWage: pf.pfWage, rate: params.pfEmployeeRate } },
      { type: 'pf_employer', amount: pf.pfEmployer, basis: { pfWage: pf.pfWage, rate: params.pfEmployerRate } },
      { type: 'eps_employer', amount: pf.epsEmployer, basis: { pfWage: pf.pfWage, rate: params.epsRate } },
      { type: 'esi_employee', amount: esi.esiEmployee, basis: { gross: grossEarnings, applicable: esi.applicable } },
      { type: 'esi_employer', amount: esi.esiEmployer, basis: { gross: grossEarnings, applicable: esi.applicable } },
      { type: 'pt', amount: pt, basis: { state: location?.state, gross: grossEarnings } },
      { type: 'tds', amount: tds, basis: { fiscalYear, regime: compensation.taxRegime } },
      { type: 'gratuity_accrual', amount: gratuityAccrual, basis: { basicPlusDa: basic + da } },
    ];
    for (const row of deductionRows) {
      await tx.statutoryDeduction.create({
        data: { payslipId: payslip.id, type: row.type as never, amount: row.amount, computationBasis: row.basis as unknown as Prisma.InputJsonValue },
      });
    }

    return { grossEarnings, totalDeductions, netPay };
  }

  async varianceReport(tenantId: string, runId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const run = await tx.payrollRun.findUniqueOrThrow({ where: { id: runId } });
      const payslips = await tx.payslip.findMany({ where: { payrollRunId: runId } });
      const previous = await tx.payrollRun.findFirst({
        where: { tenantId, runType: 'regular', period: { lt: run.period } },
        orderBy: { period: 'desc' },
      });
      const variance = previous && Number(previous.totalNet) > 0
        ? ((Number(run.totalNet) - Number(previous.totalNet)) / Number(previous.totalNet)) * 100
        : 0;
      const flagged = payslips
        .filter((p) => p.status === 'held')
        .map((p) => ({ employeeId: p.employeeId, reason: 'NEGATIVE_NET_PAY', netPay: Number(p.netPay) }));
      return {
        period: run.period,
        employeeCount: payslips.length,
        totalNetPay: Number(run.totalNet),
        varianceVsPreviousPeriod: Math.round(variance * 10) / 10,
        flagged,
      };
    });
  }

  async editPayslipLineItem(tenantId: string, runId: string, employeeId: string, actorUserId: string, newLineItems: object, comment: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const run = await tx.payrollRun.findUniqueOrThrow({ where: { id: runId } });
      if (run.status !== 'review') throw AppErrors.conflict('INVALID_STATE', 'Payslips can only be edited while the run is in review');
      const payslip = await tx.payslip.findUniqueOrThrow({ where: { payrollRunId_employeeId: { payrollRunId: runId, employeeId } } });

      await tx.auditLog.create({
        data: {
          tenantId, actorUserId, entityType: 'payslip', entityId: payslip.id, action: 'manual_edit',
          beforeValue: payslip.lineItems as Prisma.InputJsonValue, afterValue: newLineItems as Prisma.InputJsonValue, comment,
        },
      });
      return tx.payslip.update({ where: { id: payslip.id }, data: { lineItems: newLineItems as Prisma.InputJsonValue } });
    });
  }

  async approveRun(tenantId: string, runId: string, approvedByUserId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const run = await tx.payrollRun.findUniqueOrThrow({ where: { id: runId } });
      if (run.status !== 'review') throw AppErrors.conflict('INVALID_STATE', 'Only a run in review can be approved');
      const heldCount = await tx.payslip.count({ where: { payrollRunId: runId, status: 'held' } });
      if (heldCount > 0) {
        throw AppErrors.unprocessable('NEGATIVE_NET_PAY_UNRESOLVED', `${heldCount} payslip(s) are held for negative net pay and must be resolved first`);
      }
      const disbursementFileUrl = await this.generateDisbursementFile(tx, runId);
      return tx.payrollRun.update({
        where: { id: runId },
        data: { status: 'approved', approvedAt: new Date(), approvedByUserId, disbursementFileUrl },
      });
    });
  }

  private async generateDisbursementFile(tx: Tx, runId: string): Promise<string> {
    // Bank-specific NEFT/RTGS bulk formatting is pluggable per spec §8 — no real
    // bank format wired up here (would need a specific bank's template + real
    // account). Stores a plain CSV inline as a placeholder for that pluggable
    // formatter, rather than faking a specific bank's file layout.
    const payslips = await tx.payslip.findMany({ where: { payrollRunId: runId }, include: { payrollRun: true } });
    const rows = ['beneficiary_name,account_number,ifsc,amount,narration'];
    for (const p of payslips) {
      const employee = await tx.employee.findUnique({ where: { id: p.employeeId } });
      const bank = await tx.employeeBankAccount.findUnique({ where: { employeeId: p.employeeId } });
      rows.push(
        `${employee?.firstName ?? ''} ${employee?.lastName ?? ''},${bank?.accountNumber ?? 'MISSING'},${bank?.ifsc ?? 'MISSING'},${p.netPay},Salary ${p.payrollRun.period}`,
      );
    }
    return `data:text/csv;base64,${Buffer.from(rows.join('\n')).toString('base64')}`;
  }

  async disburseRun(tenantId: string, runId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const run = await tx.payrollRun.findUniqueOrThrow({ where: { id: runId } });
      if (run.status !== 'approved') throw AppErrors.conflict('INVALID_STATE', 'Only an approved run can be disbursed');
      await tx.payslip.updateMany({ where: { payrollRunId: runId }, data: { status: 'paid' } });
      return tx.payrollRun.update({ where: { id: runId }, data: { status: 'disbursed', disbursedAt: new Date() } });
    });
  }

  async closeRun(tenantId: string, runId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const run = await tx.payrollRun.findUniqueOrThrow({ where: { id: runId } });
      if (run.status !== 'disbursed') throw AppErrors.conflict('INVALID_STATE', 'Only a disbursed run can be closed');
      return tx.payrollRun.update({ where: { id: runId }, data: { status: 'closed' } });
    });
  }

  async getEmployeePayslips(tenantId: string, employeeId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.payslip.findMany({ where: { tenantId, employeeId, status: { not: 'held' } }, orderBy: { createdAt: 'desc' } }),
    );
  }
}
