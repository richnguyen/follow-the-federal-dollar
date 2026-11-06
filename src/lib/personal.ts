import { HH, tax } from '../data';
import type { FilingStatus } from '../data/types';
import { CTX } from './assess';
import { optionPath } from './plan';
import type { Levers } from './sandbox';
import { load } from './storage';
import { bracketTax, estimateTaxes } from './tax';

// What a plan means for one person's own federal tax receipt. Only changes that land directly on
// a wage earner's income and payroll taxes are counted in dollars; the rest are named, with CBO's
// amount spread across all households where that is the honest way to show them.

export interface PersonalEffect {
  wages: number;
  status: FilingStatus;
  /** Yearly change in the person's own income and payroll taxes, in dollars. */
  direct: number;
  lines: { id: string; label: string; amount: number }[];
  /** Consumption taxes, averaged across all households in the final projection year. */
  prices: { names: string[]; perHousehold: number };
  /** Cards that change tax breaks some people use. */
  breaks: string[];
  /** Cards that change benefits or programs rather than taxes. */
  benefits: string[];
}

const PRICE_CARDS = ['vat-5pct', 'carbon-tax-25', 'gas-tax-15c', 'alcohol-tax'];
const BREAK_CARDS: Record<string, string> = { 'cap-health-exclusion': 'if you get health insurance through work', 'limit-itemized-15pct': 'if you itemize deductions' };

export const savedWages = () => ({ wages: load<number>('wages', 65000), status: load<FilingStatus>('status', 'single') });

export function personalEffect(ids: string[], lv: Levers, gradual: boolean, wages: number, status: FilingStatus): PersonalEffect {
  const base = estimateTaxes(wages, status, tax);
  const lines: PersonalEffect['lines'] = [];
  if (ids.includes('income-tax-rates-1pt')) {
    const up = bracketTax(base.taxable, tax.brackets[status].map(([lo, r]) => [lo, r + 0.01] as [number, number])).tax;
    lines.push({ id: 'income-tax-rates-1pt', label: 'Every income tax rate up 1 point', amount: up - base.incomeTax });
  }
  if (ids.includes('ss-tax-earnings-over-250k') && wages > 250000) {
    lines.push({ id: 'ss-tax-earnings-over-250k', label: 'Social Security tax on your earnings above $250,000 (your 6.2% half)', amount: (wages - 250000) * tax.ssRate });
  }
  if (lv.revenues) {
    lines.push({ id: 'revenues', label: `All taxes ${lv.revenues > 0 ? 'up' : 'down'} ${Math.abs(lv.revenues)}%, if shared evenly`, amount: (base.total * lv.revenues) / 100 });
  }
  const sel = CTX.options.filter((o) => ids.includes(o.id));
  const priceSel = sel.filter((o) => PRICE_CARDS.includes(o.id));
  const perHousehold = priceSel.reduce((s, o) => s + optionPath(o, CTX.baseline, gradual).at(-1)!, 0) / HH;
  return {
    wages, status,
    direct: lines.reduce((s, l) => s + l.amount, 0),
    lines,
    prices: { names: priceSel.map((o) => o.name), perHousehold },
    breaks: sel.filter((o) => BREAK_CARDS[o.id]).map((o) => `${o.name} (${BREAK_CARDS[o.id]})`),
    benefits: sel.filter((o) => o.side === 'spending').map((o) => o.name),
  };
}
