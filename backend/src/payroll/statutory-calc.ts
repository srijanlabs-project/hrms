import { Prisma } from '@prisma/client';

/**
 * Pure calculation functions per Payroll spec §3. All rates/ceilings/slabs are
 * read from the versioned statutory_parameters / statutory_pt_slabs /
 * statutory_tds_slabs tables — never hardcoded — per the spec's explicit
 * warning: "verify current rates/slabs/ceilings ... before go-live."
 *
 * Known simplification: ESI's "continues until end of contribution period"
 * rule (spec §3.2 — once crossed mid-period, keep deducting through Apr–Sep or
 * Oct–Mar) is NOT implemented; this only checks the current period's gross
 * against the threshold. Flagged here rather than silently wrong — fixing it
 * needs a per-employee ESI-contribution-period tracking table.
 */

export interface StatutoryParams {
  pfWageCeiling: number;
  pfEmployeeRate: number;
  pfEmployerRate: number;
  epsRate: number;
  epsWageCeiling: number;
  esiWageThreshold: number;
  esiEmployeeRate: number;
  esiEmployerRate: number;
}

export async function loadStatutoryParams(
  tx: Prisma.TransactionClient,
  asOf: Date,
): Promise<StatutoryParams> {
  const keys = [
    'pf_wage_ceiling', 'pf_employee_rate', 'pf_employer_rate', 'eps_rate', 'eps_wage_ceiling',
    'esi_wage_threshold', 'esi_employee_rate', 'esi_employer_rate',
  ];
  const values: Record<string, number> = {};
  for (const key of keys) {
    const row = await tx.statutoryParameter.findFirst({
      where: { key, effectiveFrom: { lte: asOf } },
      orderBy: { effectiveFrom: 'desc' },
    });
    values[key] = row ? Number(row.value) : 0;
  }
  return {
    pfWageCeiling: values.pf_wage_ceiling,
    pfEmployeeRate: values.pf_employee_rate,
    pfEmployerRate: values.pf_employer_rate,
    epsRate: values.eps_rate,
    epsWageCeiling: values.eps_wage_ceiling,
    esiWageThreshold: values.esi_wage_threshold,
    esiEmployeeRate: values.esi_employee_rate,
    esiEmployerRate: values.esi_employer_rate,
  };
}

export function computePf(basicPlusDa: number, params: StatutoryParams, pfOptedOut: boolean) {
  if (pfOptedOut) {
    return { pfEmployee: 0, pfEmployer: 0, epsEmployer: 0, pfWage: 0 };
  }
  const pfWage = Math.min(basicPlusDa, params.pfWageCeiling || Infinity);
  const pfEmployee = Math.round(pfWage * params.pfEmployeeRate);
  const epsEmployer = Math.round(Math.min(pfWage, params.epsWageCeiling || Infinity) * params.epsRate);
  const pfEmployer = Math.round(pfWage * params.pfEmployerRate) - epsEmployer;
  return { pfEmployee, pfEmployer, epsEmployer, pfWage };
}

export function computeEsi(grossEarnings: number, params: StatutoryParams) {
  const applicable = params.esiWageThreshold > 0 && grossEarnings <= params.esiWageThreshold;
  return {
    applicable,
    esiEmployee: applicable ? Math.round(grossEarnings * params.esiEmployeeRate) : 0,
    esiEmployer: applicable ? Math.round(grossEarnings * params.esiEmployerRate) : 0,
  };
}

export async function computePt(
  tx: Prisma.TransactionClient,
  state: string,
  grossEarnings: number,
  periodDate: Date,
): Promise<number> {
  const slabs = await tx.statutoryPtSlab.findMany({
    where: { state, effectiveFrom: { lte: periodDate } },
    orderBy: { effectiveFrom: 'desc' },
  });
  const latestEffectiveFrom = slabs[0]?.effectiveFrom;
  const currentSlabs = slabs.filter((s) => s.effectiveFrom.getTime() === latestEffectiveFrom?.getTime());
  const match = currentSlabs.find(
    (s) => grossEarnings >= Number(s.monthlyGrossMin) && (s.monthlyGrossMax == null || grossEarnings <= Number(s.monthlyGrossMax)),
  );
  if (!match) return 0;
  const month = periodDate.getUTCMonth() + 1;
  return match.monthOverride === month ? Number(match.ptAmount) : Number(match.ptAmount);
}

export async function computeTds(
  tx: Prisma.TransactionClient,
  params: {
    employeeId: string;
    taxRegime: 'old' | 'new';
    monthlyTaxableEarnings: number;
    fiscalYear: string;
    remainingMonthsInFiscalYear: number;
  },
): Promise<number> {
  const projectedAnnualIncome = params.monthlyTaxableEarnings * 12;
  const slabs = await tx.statutoryTdsSlab.findMany({
    where: { fiscalYear: params.fiscalYear, taxRegime: params.taxRegime },
    orderBy: { incomeMin: 'asc' },
  });
  let tax = 0;
  for (const slab of slabs) {
    const min = Number(slab.incomeMin);
    const max = slab.incomeMax != null ? Number(slab.incomeMax) : Infinity;
    if (projectedAnnualIncome <= min) continue;
    const taxableInSlab = Math.min(projectedAnnualIncome, max) - min;
    if (taxableInSlab > 0) tax += taxableInSlab * (Number(slab.ratePercent) / 100);
  }

  const alreadyDeducted = await tx.statutoryDeduction.aggregate({
    _sum: { amount: true },
    where: {
      type: 'tds',
      payslip: { employeeId: params.employeeId, payrollRun: { period: { startsWith: params.fiscalYear.slice(0, 4) } } },
    },
  });
  const deductedSoFar = Number(alreadyDeducted._sum.amount ?? 0);
  const monthlyTds = (tax - deductedSoFar) / Math.max(1, params.remainingMonthsInFiscalYear);
  return Math.max(0, Math.round(monthlyTds));
}

export function computeGratuityAccrual(basicPlusDa: number): number {
  return Math.round(((basicPlusDa * 15) / 26 / 12) * 100) / 100;
}
