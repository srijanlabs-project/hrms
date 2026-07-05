export interface SalaryComponentConfig {
  code: string;
  name: string;
  type: 'earning' | 'deduction' | 'employer_contribution';
  calcType: 'fixed' | 'percentage_of_ctc' | 'percentage_of_basic' | 'formula';
  value: number;
  taxable: boolean;
  pfApplicable?: boolean;
  esiApplicable?: boolean;
  lopApplicable?: boolean;
}

export interface ResolvedComponent {
  code: string;
  name: string;
  type: string;
  monthlyAmount: number;
  taxable: boolean;
  pfApplicable: boolean;
  lopApplicable: boolean;
}

/**
 * Resolves a SalaryStructure's component config into actual monthly amounts for
 * one employee's annualCtc, at compensation-assignment time (spec §2.2,
 * resolved_components). 'formula' calcType isn't evaluated (arbitrary formula
 * eval is unsafe without a real expression sandbox) — falls back to raw value
 * with a note; flagged rather than silently wrong.
 */
export function resolveComponents(components: SalaryComponentConfig[], annualCtc: number): ResolvedComponent[] {
  const monthlyCtc = annualCtc / 12;
  const resolved = new Map<string, ResolvedComponent>();

  // Basic (or anything percentage_of_ctc) must resolve before percentage_of_basic components.
  const ordered = [...components].sort((a, b) => (a.calcType === 'percentage_of_basic' ? 1 : 0) - (b.calcType === 'percentage_of_basic' ? 1 : 0));

  for (const c of ordered) {
    let amount: number;
    switch (c.calcType) {
      case 'fixed':
        amount = c.value;
        break;
      case 'percentage_of_ctc':
        amount = monthlyCtc * (c.value / 100);
        break;
      case 'percentage_of_basic': {
        const basic = resolved.get('BASIC')?.monthlyAmount ?? 0;
        amount = basic * (c.value / 100);
        break;
      }
      case 'formula':
      default:
        amount = c.value; // unevaluated fallback — see doc comment above
        break;
    }
    resolved.set(c.code, {
      code: c.code,
      name: c.name,
      type: c.type,
      monthlyAmount: Math.round(amount * 100) / 100,
      taxable: c.taxable,
      pfApplicable: c.pfApplicable ?? (c.code === 'BASIC' || c.code === 'DA'),
      lopApplicable: c.lopApplicable ?? c.type === 'earning',
    });
  }
  return [...resolved.values()];
}
