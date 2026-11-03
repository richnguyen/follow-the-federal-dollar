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
  if (h) return { y: h, actual: true, label: `Mandatory, discretionary, and interest amounts for FY${fy} are from the OMB Historical Tables.`, short: `FY${fy}` };
  // The Treasury statement doesn't classify spending as mandatory or discretionary; the official
  // split arrives later, so show the most recent fiscal year that has final figures.
  const last = cbo.history.at(-1)!;
  return {
    y: last,
    actual: true,
    label: `Shown for FY${last.fy}, the most recent year with a final official split into mandatory, discretionary, and interest spending (OMB Historical Tables, published with the FY2027 budget). FY${fy}’s split will be published with next year’s budget.`,
    short: `FY${last.fy}`,
  };
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

/** Follow a path of name patterns down the account tree. */
export function findPath(root: AccountNode, path: RegExp[]): AccountNode | null {
  let n: AccountNode | undefined = root;
  for (const re of path) {
    n = n?.children?.find((c) => re.test(c.name));
    if (!n) return null;
  }
  return n ?? null;
}

// The largest benefit programs, as individual Treasury accounts (benefit payments only, so no
// transfers between government accounts are counted).
export const BENEFIT_ACCOUNTS: { label: string; color: string; path: RegExp[] }[] = [
  { label: 'Social Security retirement & survivor benefits', color: 'var(--c-ss)', path: [/^Social Security Administration/, /Old-Age and Survivors/, /^Benefit Payments/] },
  { label: 'Medicaid (federal grants to states)', color: 'var(--c-health)', path: [/Health and Human Services/, /Medicare and Medicaid/, /^Grants to States for Medicaid/] },
  { label: 'Medicare Part B (doctors & outpatient)', color: 'var(--c-medicare)', path: [/Health and Human Services/, /Medicare and Medicaid/, /Supplementary Medical/, /^Benefit Payments/] },
  { label: 'Medicare Part A (hospitals)', color: 'var(--c-medicare)', path: [/Health and Human Services/, /Medicare and Medicaid/, /Hospital Insurance/, /^Benefit Payments/] },
  { label: 'Veterans’ disability compensation & pensions', color: 'var(--c-veterans)', path: [/Veterans Affairs/, /Benefits Programs/, /Compensation and Pensions/] },
  { label: 'Medicare Part D (prescription drugs)', color: 'var(--c-medicare)', path: [/Health and Human Services/, /Medicare and Medicaid/, /Supplementary Medical/, /Prescription Drugs/] },
  { label: 'Social Security disability benefits', color: 'var(--c-ss)', path: [/^Social Security Administration/, /Disability Insurance/, /^Benefit Payments/] },
  { label: 'ACA marketplace premium tax credits', color: 'var(--c-health)', path: [/Department of the Treasury/, /Internal Revenue Service/, /Premium Tax Credit/] },
  { label: 'SNAP (food assistance)', color: 'var(--c-income)', path: [/Department of Agriculture/, /Food and Nutrition/, /Supplemental Nutrition Assistance/] },
  { label: 'Supplemental Security Income (SSI)', color: 'var(--c-income)', path: [/^Social Security Administration/, /Supplemental Security Income/] },
  { label: 'Earned Income Tax Credit (refunds)', color: 'var(--c-income)', path: [/Department of the Treasury/, /Internal Revenue Service/, /Earned Income Credit/] },
  { label: 'School meals & child nutrition', color: 'var(--c-income)', path: [/Department of Agriculture/, /Food and Nutrition/, /Child Nutrition/] },
  { label: 'Child Tax Credit (refunds)', color: 'var(--c-income)', path: [/Department of the Treasury/, /Internal Revenue Service/, /Child Tax Credit/] },
  { label: 'Children’s Health Insurance Program (CHIP)', color: 'var(--c-health)', path: [/Health and Human Services/, /Medicare and Medicaid/, /Children's Health Insurance/] },
];

export function benefitPrograms() {
  return BENEFIT_ACCOUNTS.map((b) => ({ ...b, node: findPath(accounts.root, b.path) }))
    .filter((b) => b.node && b.node.amount > 0)
    .map((b) => ({ id: b.label, label: b.label, value: b.node!.amount, color: b.color, prior: b.node!.prior }))
    .sort((a, b) => b.value - a.value);
}
