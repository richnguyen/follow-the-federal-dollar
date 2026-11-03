import { accounts, budget, cbo } from '../data';
import type { AccountNode, CBOYear, CategoryId } from '../data/types';
import { CATEGORIES } from './categories';

export interface CatTotal {
  id: CategoryId;
  label: string;
  short: string;
  color: string;
  blurb: string;
  amount: number;
  offset: number; // offsetting receipts folded in (negative), only for "other"
}

/** Net outlays for each spending category in a fiscal year (Treasury MTS Table 9). */
export function categoryTotals(fy: number): CatTotal[] {
  const rows = budget.functionsByFY[String(fy)] ?? [];
  return CATEGORIES.map((c) => {
    let amount = 0;
    let offset = 0;
    for (const r of rows) {
      if (c.functions.includes(r.code)) {
        amount += r.amount;
        if (r.category === 'offset') offset += r.amount;
      }
    }
    return { id: c.id, label: c.label, short: c.short, color: c.color, blurb: c.blurb, amount, offset };
  });
}

/** CBO budget-concept split (mandatory / discretionary / interest) for a fiscal year. */
export function bucketYear(fy: number): { y: CBOYear; label: string; short: string; actual: boolean } {
  const h = cbo.history.find((r) => r.fy === fy);
  if (h) return { y: h, actual: true, label: `Mandatory, discretionary, and interest amounts are CBO’s historical figures for FY${fy}.`, short: `FY${fy}` };
  const b = cbo.baseline.find((r) => r.fy === fy);
  if (b) {
    return {
      y: b,
      actual: false,
      label: `The split into mandatory, discretionary, and interest is CBO’s ${cbo.vintage} estimate for FY${fy}; Treasury’s final total outlays for the year were reported separately and may differ slightly.`,
      short: `CBO estimate for FY${fy}`,
    };
  }
  const last = cbo.history.at(-1)!;
  return { y: last, actual: true, label: `Mandatory, discretionary, and interest amounts are CBO’s historical figures for FY${last.fy}, the latest available.`, short: `FY${last.fy}` };
}

export function cboSeries(): CBOYear[] {
  const lastActual = cbo.history.at(-1)!.fy;
  return [...cbo.history, ...cbo.baseline.filter((b) => b.fy > lastActual)];
}

export function findNode(root: AccountNode, re: RegExp, depth = 3): AccountNode | null {
  const stack: [AccountNode, number][] = [[root, 0]];
  while (stack.length) {
    const [n, d] = stack.shift()!;
    if (d > 0 && re.test(n.name)) return n;
    if (d < depth) for (const c of n.children ?? []) stack.push([c, d + 1]);
  }
  return null;
}

export function flattenAccounts(root: AccountNode): { path: string[]; node: AccountNode }[] {
  const out: { path: string[]; node: AccountNode }[] = [];
  const walk = (n: AccountNode, path: string[]) => {
    if (!n.children || n.children.length === 0) out.push({ path, node: n });
    else for (const c of n.children) walk(c, [...path, c.name]);
  };
  for (const c of root.children ?? []) walk(c, [c.name]);
  return out;
}

export const accountsRoot = accounts.root;
