import type { FilingStatus, TaxParams } from '../data/types';

export interface TaxResult {
  wages: number;
  taxable: number;
  incomeTax: number;
  ssTax: number;
  medicareTax: number;
  total: number;
  marginal: number;
  effective: number;
}

/** Federal income tax on taxable income from bracket table [[lowerBound, rate], ...]. */
export function bracketTax(taxable: number, brackets: [number, number][]): { tax: number; marginal: number } {
  let tax = 0;
  let marginal = brackets[0][1];
  for (let i = 0; i < brackets.length; i++) {
    const [lo, rate] = brackets[i];
    const hi = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity;
    if (taxable <= lo) break;
    tax += (Math.min(taxable, hi) - lo) * rate;
    marginal = rate;
  }
  return { tax, marginal };
}

/**
 * Employee-side federal taxes for a wage earner with no other income who takes the standard
 * deduction and no credits. A deliberately simple estimate for illustration.
 */
export function estimateTaxes(wages: number, status: FilingStatus, p: TaxParams): TaxResult {
  const taxable = Math.max(0, wages - p.standardDeduction[status]);
  const { tax, marginal } = bracketTax(taxable, p.brackets[status]);
  const ssTax = Math.min(wages, p.ssWageBase) * p.ssRate;
  const medicareTax = wages * p.medicareRate + Math.max(0, wages - p.addlMedicareThreshold[status]) * p.addlMedicareRate;
  const total = tax + ssTax + medicareTax;
  return { wages, taxable, incomeTax: tax, ssTax, medicareTax, total, marginal, effective: wages > 0 ? total / wages : 0 };
}
