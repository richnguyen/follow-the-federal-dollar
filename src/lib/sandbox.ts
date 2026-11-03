import type { CBOYear } from '../data/types';

// A simple, transparent 10-year model on top of CBO's baseline.
// Each lever is a percentage change applied to that category in every projected year.
// Net interest is re-estimated from the change in debt: interest_t scales with debt_{t-1}.
export const LEVERS = [
  { id: 'revenues', label: 'All tax revenue', color: 'var(--c-emph)', min: -20, max: 30 },
  { id: 'socialSecurity', label: 'Social Security', color: 'var(--c-ss)', min: -30, max: 15 },
  { id: 'medicare', label: 'Medicare', color: 'var(--c-medicare)', min: -30, max: 15 },
  { id: 'medicaid', label: 'Medicaid', color: 'var(--c-health)', min: -40, max: 15 },
  { id: 'otherMandatory', label: 'Other mandatory', color: 'var(--c-income)', min: -40, max: 20 },
  { id: 'defense', label: 'Defense', color: 'var(--c-defense)', min: -50, max: 30 },
  { id: 'nondefense', label: 'Non-defense discretionary', color: 'var(--c-other)', min: -50, max: 30 },
] as const;

export type LeverId = (typeof LEVERS)[number]['id'];
export type Levers = Record<LeverId, number>; // percent

export const ZERO: Levers = { revenues: 0, socialSecurity: 0, medicare: 0, medicaid: 0, otherMandatory: 0, defense: 0, nondefense: 0 };

export interface SimYear { fy: number; revenues: number; programs: number; interest: number; deficit: number; debt: number; gdp: number }

export function simulate(baseline: CBOYear[], startDebt: number, lv: Levers): SimYear[] {
  const out: SimYear[] = [];
  let debt = startDebt;
  let baseDebtPrev = startDebt;
  for (const b of baseline) {
    const f = (k: LeverId) => 1 + lv[k] / 100;
    const revenues = b.revenues * f('revenues');
    const programs =
      b.socialSecurity * f('socialSecurity') + b.medicare * f('medicare') + b.medicaid * f('medicaid') +
      b.otherMandatory * f('otherMandatory') + b.defense * f('defense') + b.nondefense * f('nondefense');
    const interest = b.netInterest * (baseDebtPrev > 0 ? debt / baseDebtPrev : 1);
    const deficit = programs + interest - revenues;
    // CBO's debt changes by slightly more or less than the deficit (student loans, cash balance);
    // carry that "other means of financing" through unchanged so the baseline reproduces exactly.
    const otherFinancing = b.debtPublic - baseDebtPrev - b.deficit;
    debt = debt + deficit + otherFinancing;
    baseDebtPrev = b.debtPublic;
    out.push({ fy: b.fy, revenues, programs, interest, deficit, debt, gdp: b.gdp });
  }
  return out;
}

/** Uniform % change in a set of levers needed to balance the budget in the final year (bisection). */
export function solveBalance(baseline: CBOYear[], startDebt: number, ids: LeverId[], sign: 1 | -1): number | null {
  let lo = 0;
  let hi = 100;
  const at = (x: number) => {
    const lv = { ...ZERO };
    for (const id of ids) lv[id] = sign * x;
    return simulate(baseline, startDebt, lv).at(-1)!.deficit;
  };
  if (at(hi) > 0) return null;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) > 0) lo = mid;
    else hi = mid;
  }
  return hi;
}
