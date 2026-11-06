import { accounts, budget, cbo, geo, tax } from '../data';
import { dollars, money, pct } from '../lib/format';
import { estimateTaxes } from '../lib/tax';
import { OPTIONS_DATA } from '../lib/planData';
import { load, save } from '../lib/storage';

// The Daily Dollar: five higher-or-lower calls a day on real federal numbers. Everyone gets the
// same puzzle on the same date (it is chosen from the date, in this browser), so results can be
// compared without a server.

export interface Item { id: string; label: string; value: number; shown: string; source: { name: string; url?: string; id?: string } }
export interface Pool { id: string; title: string; ask: string; unit: string; items: Item[] }

// Treasury's agency accounts, with plain names. Only accounts whose name says what they are.
const SPEND_NAMES: Record<string, string> = {
  Senate: 'The U.S. Senate', 'House of Representatives': 'The House of Representatives',
  'National Aeronautics and Space Administration': 'NASA', 'National Institutes of Health': 'The National Institutes of Health',
  'Centers for Disease Control and Prevention': 'The CDC', 'Federal Bureau of Investigation': 'The FBI',
  'Federal Emergency Management Agency': 'FEMA', 'United States Coast Guard': 'The Coast Guard',
  'Immigration and Customs Enforcement': 'Immigration and Customs Enforcement (ICE)', 'U.S. Customs and Border Protection': 'Customs and Border Protection',
  'Transportation Security Administration': 'The TSA', 'Federal Aviation Administration': 'The FAA',
  'Federal Highway Administration': 'Federal highway aid', 'Federal Transit Administration': 'Federal transit aid',
  'Food and Nutrition Service': 'Food aid (SNAP, school meals, WIC)', 'Forest Service': 'The Forest Service',
  'National Oceanic and Atmospheric Administration': 'NOAA (weather and oceans)', 'National Nuclear Security Administration': 'Nuclear security (NNSA)',
  'Veterans Health Administration': 'Veterans’ health care', 'Military Personnel': 'Military pay',
  Procurement: 'Military equipment purchases', 'Interest on the Public Debt': 'Interest on the debt',
  'Federal Prison System': 'Federal prisons', 'Indian Health Service': 'The Indian Health Service',
  'National Science Foundation': 'The National Science Foundation', 'Environmental Protection Agency': 'The EPA',
  'Department of State': 'The State Department', 'Department of Education': 'The Department of Education',
  'Department of Energy': 'The Department of Energy', 'Social Security Administration': 'The Social Security Administration',
  'Department of Defense--Military Programs': 'The Pentagon’s military programs', 'Judicial Branch': 'The federal courts',
  'Department of Justice': 'The Justice Department', 'Small Business Administration': 'The Small Business Administration',
  'Corps of Engineers': 'The Army Corps of Engineers', 'Military Retirement': 'Military retirement pay',
  'Department of Homeland Security': 'Homeland Security, in all', 'Department of Veterans Affairs': 'Veterans Affairs, in all',
};

type Node = { name: string; amount: number; children?: Node[] };
function spendItems(): Item[] {
  const out: Item[] = [];
  const seen = new Set<string>();
  const walk = (n: Node, depth: number) => {
    if (depth > 0 && SPEND_NAMES[n.name] && n.amount > 0 && !seen.has(n.name)) {
      seen.add(n.name);
      out.push({ id: 's:' + n.name, label: SPEND_NAMES[n.name], value: n.amount, shown: money(n.amount), source: { name: `Treasury, Monthly Treasury Statement, FY${accounts.fy} outlays`, id: 'mts5' } });
    }
    if (depth < 3) n.children?.forEach((c) => walk(c, depth + 1));
  };
  walk(accounts.root as Node, 0);
  return out;
}

const TERRITORIES = new Set(['PR', 'GU', 'VI', 'AS', 'MP']);
const stateItems = (): Item[] => geo.states.filter((s) => !TERRITORIES.has(s.abbr)).map((s) => ({
  id: 'g:' + s.abbr, label: s.abbr === 'WA' ? 'Washington State' : s.name, value: s.perCapita, shown: `${dollars(s.perCapita)} per person`,
  source: { name: `USAspending.gov, federal awards by state, FY${geo.fy} (not counting Medicare)`, id: 'usaspending-geo' },
}));

const cboItems = (): Item[] => OPTIONS_DATA.options.map((o) => ({
  id: 'c:' + o.id, label: o.name, value: o.savings10, shown: `${money(o.savings10 * 1e9)} over ten years`,
  source: { name: 'CBO, Options for Reducing the Deficit', url: o.source.url },
}));

// ---------- pools for the themed weeks ----------
// Budget Week: the budget's own categories, and deficits over time.
const FUNCTION_NAMES: Record<string, string> = {
  '050': 'National defense', '150': 'International affairs (diplomacy and foreign aid)', '250': 'Science, space, and technology',
  '270': 'Energy', '300': 'Natural resources and the environment', '350': 'Agriculture', '400': 'Transportation',
  '450': 'Community and regional development', '500': 'Education, job training, and social services',
  '550': 'Health (Medicaid and other health programs)', '570': 'Medicare', '600': 'Income security (SNAP, SSI, tax credits, unemployment)',
  '650': 'Social Security', '700': 'Veterans’ benefits and services', '750': 'Courts, law enforcement, and prisons',
  '800': 'General government (Congress, the IRS, and more)', '900': 'Interest on the debt',
};
const functionItems = (): Item[] => (budget.functionsByFY[String(budget.latestFY)] ?? [])
  .filter((f) => FUNCTION_NAMES[f.code] && f.amount > 0)
  .map((f) => ({ id: 'f:' + f.code, label: FUNCTION_NAMES[f.code], value: f.amount, shown: money(f.amount), source: { name: `Treasury, Monthly Treasury Statement, outlays by budget function, FY${budget.latestFY}`, id: 'mts9' } }));
const deficitItems = (): Item[] => cbo.history
  .filter((h) => h.actual && h.deficit > 0 && h.gdp > 0)
  .map((h) => ({ id: 'd:' + h.fy, label: `The deficit in FY${h.fy}`, value: h.deficit / h.gdp, shown: `${pct(h.deficit / h.gdp, 1)} of GDP`, source: { name: 'OMB Historical Tables (deficits and GDP by fiscal year)', id: 'omb-hist' } }));

// Tax Week: what each tax brings in, what Uncle Sam collects by month, a paycheck's taxes, and
// CBO's tax options.
const TAX_NAMES: Record<string, string> = {
  individual: 'Individual income taxes', payroll: 'Payroll taxes (Social Security and Medicare)', corporate: 'Corporate income taxes',
  excise: 'Excise taxes (gas, alcohol, tobacco…)', estate: 'Estate and gift taxes', customs: 'Customs duties (tariffs)',
};
const taxSourceItems = (): Item[] => Object.entries(budget.receiptsByFY)
  .filter(([fy]) => Number(fy) >= 2015)
  .flatMap(([fy, rows]) => rows.filter((r) => TAX_NAMES[r.id] && r.amount > 0).map((r) => ({ id: `t:${r.id}:${fy}`, label: `${TAX_NAMES[r.id]}, FY${fy}`, value: r.amount, shown: money(r.amount), source: { name: `Treasury, Monthly Treasury Statement, receipts by source, FY${fy}`, id: 'mts9' } })));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthItems = (): Item[] => budget.monthly.slice(-60).filter((m) => m.receipts > 0).map((m) => {
  const [y, mo] = m.date.split('-').map(Number);
  return { id: 'm:' + m.date, label: `What Uncle Sam collected in ${MONTHS[mo - 1]} ${y}`, value: m.receipts, shown: money(m.receipts), source: { name: 'Treasury, Monthly Treasury Statement, receipts by month', id: 'mts9' } };
});
const paycheckItems = (): Item[] => [25000, 40000, 60000, 80000, 100000, 150000, 200000, 300000, 500000].flatMap((w) => (['single', 'married'] as const).map((st) => {
  const r = estimateTaxes(w, st, tax);
  return { id: `p:${st}:${w}`, label: st === 'single' ? `A single worker earning ${dollars(w)}` : `A married couple earning ${dollars(w)} (one paycheck)`, value: r.total, shown: `${dollars(r.total)} a year`, source: { name: `IRS, tax year ${tax.year} brackets and standard deduction; Social Security and Medicare tax rates`, url: tax.sources[0]?.url } };
}));
const cboTaxItems = (): Item[] => OPTIONS_DATA.options.filter((o) => o.side === 'revenue').map((o) => ({
  id: 'ct:' + o.id, label: o.name, value: o.savings10, shown: `${money(o.savings10 * 1e9)} over ten years`,
  source: { name: 'CBO, Options for Reducing the Deficit', url: o.source.url },
}));

export const THEME_POOLS: Record<ThemeId, Pool[]> = {
  budget: [
    { id: 'functions', title: `Federal spending by budget function, FY${budget.latestFY}`, ask: 'spent more or less than', unit: 'spending in a year, by the categories Congress budgets in', items: functionItems() },
    { id: 'deficits', title: `Deficits through the years, FY${cbo.history.find((h) => h.actual)?.fy ?? 1962}–FY${[...cbo.history].reverse().find((h) => h.actual)?.fy ?? ''}`, ask: 'was bigger or smaller than', unit: 'the deficit, as a share of the economy (GDP)', items: deficitItems() },
    { id: 'spend', title: `What Washington spent in FY${accounts.fy}`, ask: 'spent more or less than', unit: 'spending in a year', items: spendItems() },
  ],
  tax: [
    { id: 'paycheck', title: `Federal taxes on a paycheck, tax year ${tax.year}`, ask: 'pays more or less than', unit: 'federal income, Social Security, and Medicare taxes for a year (standard deduction, wages only)', items: paycheckItems() },
    { id: 'months', title: 'What Uncle Sam collected, month by month', ask: 'collected more or less than', unit: 'all federal revenue collected in a month (April is when most returns are due)', items: monthItems() },
    { id: 'cbo-tax', title: 'What CBO’s tax options would raise over ten years', ask: 'would raise more or less than', unit: 'ten-year revenue', items: cboTaxItems() },
    { id: 'tax-sources', title: `What each federal tax brought in, FY2015–FY${budget.latestFY}`, ask: 'brought in more or less than', unit: 'revenue in a year', items: taxSourceItems() },
  ],
};

// The pool for each day of a themed week. Budget Week opens on the budget's own categories; Tax
// Week ends on Tax Day with what a paycheck pays.
const THEME_DAYS: Record<ThemeId, string[]> = {
  budget: ['functions', 'deficits', 'spend', 'functions', 'deficits', 'spend', 'functions'],
  tax: ['months', 'tax-sources', 'cbo-tax', 'paycheck', 'months', 'tax-sources', 'paycheck'],
};
const themePool = (t: Theme) => { const ps = THEME_POOLS[t.id]; return ps.find((p) => p.id === THEME_DAYS[t.id][t.day - 1]) ?? ps[0]; };

export const POOLS: Pool[] = [
  { id: 'spend', title: `What Washington spent in FY${accounts.fy}`, ask: 'spent more or less than', unit: 'spending in a year', items: spendItems() },
  { id: 'states', title: `Federal money per person, by state, FY${geo.fy}`, ask: 'got more or less per person than', unit: 'federal awards per resident', items: stateItems() },
  { id: 'cbo', title: 'What CBO’s options would save over ten years', ask: 'would save more or less than', unit: 'ten-year savings', items: cboItems() },
];

/** The first Daily Dollar. Puzzle numbers count from here. */
const LAUNCH = Date.UTC(2026, 10, 6);
export const ROUNDS = 5;

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dayNumber = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - LAUNCH) / 86400000) + 1;
};

/** FNV-1a of a string, so neighbouring dates get unrelated seeds. */
function hash(s: string) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; }
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Today's chain: an anchor and five more, each at least 25% away from the one before (no near-ties). */
export function puzzleFor(key: string): { n: number; pool: Pool; chain: Item[]; theme: Theme | null } {
  const n = dayNumber(key);
  const theme = themeFor(key);
  const pool = theme ? themePool(theme) : POOLS[((n % POOLS.length) + POOLS.length) % POOLS.length];
  for (let attempt = 0; attempt < 50; attempt++) {
    const r = rng(hash(`daily-dollar:${key}:${attempt}`));
    r(); r();
    const left = [...pool.items];
    const chain: Item[] = [left.splice(Math.floor(r() * left.length), 1)[0]];
    while (chain.length < ROUNDS + 1) {
      const prev = chain.at(-1)!;
      const ok = left.filter((x) => Math.abs(Math.log(x.value / prev.value)) >= Math.log(1.25));
      if (!ok.length) break;
      const pick = ok[Math.floor(r() * ok.length)];
      chain.push(pick);
      left.splice(left.indexOf(pick), 1);
    }
    if (chain.length === ROUNDS + 1) return { n, pool, chain, theme };
  }
  return { n, pool, chain: pool.items.slice(0, ROUNDS + 1), theme };
}

// ---------- themed weeks ----------
// Twice a year the Daily Dollar spends a week on one subject:
//   Budget Week: the seven days from the first Monday in February, the day the law asks the
//     President to send Congress a budget request (31 U.S.C. 1105(a)).
//   Tax Week: the seven days up to and including Tax Day, when federal income tax returns are due.
// public/sw.js repeats these two date rules for the reminder's wording; keep them in step.
export type ThemeId = 'budget' | 'tax';
export interface Theme { id: ThemeId; name: string; day: number; days: number; start: string; end: string; anchor: string; finale: boolean }

const keyDate = (key: string) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
const plusDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** The first Monday in February. */
export function budgetDay(year: number) {
  const d = new Date(year, 1, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return d;
}
/**
 * Tax Day: April 15, or the next business day when the 15th is a weekend or Emancipation Day, a
 * legal holiday in Washington, D.C. (April 16, observed Friday the 15th or Monday the 17th when it
 * falls on a weekend), as the IRS applies it.
 */
export function taxDay(year: number) {
  const em = new Date(year, 3, 16);
  if (em.getDay() === 6) em.setDate(15); else if (em.getDay() === 0) em.setDate(17);
  const d = new Date(year, 3, 15);
  while (d.getDay() === 0 || d.getDay() === 6 || d.getTime() === em.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

function weeksOf(year: number) {
  const b = budgetDay(year), t = taxDay(year);
  return [
    { id: 'budget' as const, name: 'Budget Week', start: b, end: plusDays(b, 6), anchor: b },
    { id: 'tax' as const, name: 'Tax Week', start: plusDays(t, -6), end: t, anchor: t },
  ];
}
const asTheme = (w: ReturnType<typeof weeksOf>[number], d: Date): Theme => {
  const day = Math.round((d.getTime() - w.start.getTime()) / 86400000) + 1;
  return { id: w.id, name: w.name, day, days: 7, start: todayKey(w.start), end: todayKey(w.end), anchor: todayKey(w.anchor), finale: todayKey(d) === todayKey(w.anchor) && w.id === 'tax' };
};

/** The themed week this date falls in, if any. */
export function themeFor(key: string): Theme | null {
  const d = keyDate(key);
  const w = weeksOf(d.getFullYear()).find((x) => d >= x.start && d <= x.end);
  return w ? asTheme(w, d) : null;
}

/** The next themed week that starts after this date, if it starts within `within` days. */
export function nextTheme(key: string, within = 30): Theme | null {
  const d = keyDate(key);
  const ws = [...weeksOf(d.getFullYear()), ...weeksOf(d.getFullYear() + 1)].filter((w) => w.start > d).sort((a, b) => a.start.getTime() - b.start.getTime());
  const w = ws[0];
  if (!w || (w.start.getTime() - d.getTime()) / 86400000 > within) return null;
  return asTheme(w, w.start);
}

const MON = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** "Thursday, April 15" */
export const longDate = (key: string) => { const d = keyDate(key); return `${DAY[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`; };
/** "April 9–15" or "Jan. 30–Feb. 5" */
export const span = (t: Theme) => {
  const a = keyDate(t.start), b = keyDate(t.end);
  return a.getMonth() === b.getMonth() ? `${MON[a.getMonth()]} ${a.getDate()}–${b.getDate()}` : `${MON[a.getMonth()]} ${a.getDate()}–${MON[b.getMonth()]} ${b.getDate()}`;
};
/** What the week is about, in a sentence or two. */
export function themeBlurb(t: Theme) {
  if (t.id === 'budget') return `The law asks the President to send Congress a budget request by the first Monday in February (this year, ${longDate(t.anchor)}). All week, the Daily Dollar is about the budget.`;
  return t.finale ? 'It’s Tax Day: federal income tax returns are due today. The Daily Dollar is about taxes all week, ending today.' : `Federal income tax returns are due on Tax Day, ${longDate(t.anchor)}. All week, the Daily Dollar is about taxes.`;
}

// ---------- results, kept in this browser ----------
export type Results = Record<string, boolean[]>;
export const loadResults = () => load<Results>('daily', {});
export const saveResult = (key: string, answers: boolean[]) => { const r = loadResults(); r[key] = answers; save('daily', r); };

/** Days played, and how many days in a row up to today (or yesterday, if today isn't played yet). */
export function streak(r: Results, key: string) {
  const played = Object.keys(r).filter((k) => r[k].length >= ROUNDS);
  const set = new Set(played);
  const day = (k: string, back: number) => { const [y, m, d] = k.split('-').map(Number); return todayKey(new Date(y, m - 1, d - back)); };
  let start = set.has(key) ? 0 : 1;
  let run = 0;
  while (set.has(day(key, start + run))) run++;
  return { played: played.length, run };
}

/** How long until the next puzzle (local midnight), as "5 h 12 min" or "12 min". */
export function untilNext(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const m = Math.max(1, Math.round((next.getTime() - now.getTime()) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}
export const grid = (answers: boolean[]) => answers.map((a) => (a ? '🟦' : '⬜')).join('');
