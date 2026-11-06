import { accounts, geo } from '../data';
import { dollars, money } from '../lib/format';
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
export function puzzleFor(key: string): { n: number; pool: Pool; chain: Item[] } {
  const n = dayNumber(key);
  const pool = POOLS[((n % POOLS.length) + POOLS.length) % POOLS.length];
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
    if (chain.length === ROUNDS + 1) return { n, pool, chain };
  }
  return { n, pool, chain: pool.items.slice(0, ROUNDS + 1) };
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
