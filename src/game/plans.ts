import { useSyncExternalStore } from 'react';
import type { Goal } from '../lib/plan';
import { OPTIONS_DATA, PRESETS } from '../lib/planData';
import { type LeverId, type Levers, ZERO } from '../lib/sandbox';
import { load, save } from '../lib/storage';
import { DESK, LEVELS } from './levels';
import { SITE_URL } from './share';

// Shareable plans. A finished budget-desk plan travels inside the link itself, so challenges work
// on a static site with no server: ?p=10.acg&lv=r5.d-5&ph=0&by=Sam&b=01-2... Nothing is sent
// anywhere until the person chooses to share the link.

export interface SavedPlan { ids: string[]; lv: Levers; gradual: boolean; stars: number; at: string }

/** One fixed letter per CBO option, so links keep working when the data is reordered. New options get new letters. */
export const CARD_CODE: Record<string, string> = {
  'income-tax-rates-1pt': 'a', 'corp-rate-1pt': 'b', 'ss-tax-earnings-over-250k': 'c', 'carbon-tax-25': 'd',
  'vat-5pct': 'e', 'cap-health-exclusion': 'f', 'limit-itemized-15pct': 'g', 'gas-tax-15c': 'h', 'alcohol-tax': 'i',
  'carried-interest': 'j', 'medicare-advantage-benchmarks': 'k', 'site-neutral-hospital-outpatient': 'l',
  'part-b-premium-35pct': 'm', 'medicaid-per-enrollee-caps': 'n', 'raise-full-retirement-age-70': 'o', 'chained-cpi': 'p',
  'ss-benefits-high-earners': 'q', 'cut-defense-budget': 'r', 'cut-transport-education-grants': 's', 'crop-insurance-subsidies': 't',
};
const CODE_CARD = Object.fromEntries(Object.entries(CARD_CODE).map(([k, v]) => [v, k]));
const LEVER_CODE: Record<LeverId, string> = { revenues: 'r', socialSecurity: 's', medicare: 'm', medicaid: 'c', otherMandatory: 'o', defense: 'd', nondefense: 'n' };
const CODE_LEVER = Object.fromEntries(Object.entries(LEVER_CODE).map(([k, v]) => [v, k])) as Record<string, LeverId>;

/** The seven big questions, in level order, with their answers in a fixed order. */
export const BALLOT = LEVELS.flatMap((l) => l.steps.filter((s) => s.kind === 'vote' && s.vote).map((s) => {
  const v = s.vote!;
  if (v.kind === 'option') {
    const o = OPTIONS_DATA.options.find((x) => x.id === v.optionId)!;
    return { key: 'option:' + o.id, level: l.n, question: o.name, values: ['support', 'oppose'], labels: ['Support', 'Oppose'] };
  }
  return { key: v.id, level: l.n, question: v.question, values: v.choices.map((c) => c.value), labels: v.choices.map((c) => c.label) };
}));

export interface SharedPlan { level: string; goal: Goal; ids: string[]; lv: Levers; gradual: boolean; by?: string; ballot?: Record<string, string> }

const NAME_MAX = 24;
export const cleanName = (s: string) => s.replace(/[^\p{L}\p{N} .'’-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);

export function encodePlan(p: SharedPlan): string {
  const d = DESK.find((x) => x.id === p.level)!;
  const q = new URLSearchParams();
  q.set('p', `${d.n}.${p.ids.map((id) => CARD_CODE[id]).filter(Boolean).sort().join('')}`);
  const lv = (Object.keys(LEVER_CODE) as LeverId[]).filter((k) => p.lv[k]).map((k) => `${LEVER_CODE[k]}${p.lv[k]}`).join('.');
  if (lv) q.set('lv', lv);
  if (!p.gradual) q.set('ph', '0');
  if (p.by) q.set('by', cleanName(p.by));
  if (p.ballot) {
    const b = BALLOT.map((x) => { const i = x.values.indexOf(p.ballot![x.key] ?? ''); return i < 0 ? '-' : String(i); }).join('');
    if (/\d/.test(b)) q.set('b', b);
  }
  return q.toString();
}

export function decodePlan(q: URLSearchParams): SharedPlan | null {
  const m = /^(\d+)\.([a-z]*)$/.exec(q.get('p') ?? '');
  if (!m) return null;
  const d = DESK.find((x) => x.n === Number(m[1]));
  if (!d) return null;
  const ids = [...new Set(m[2].split('').map((c) => CODE_CARD[c]).filter(Boolean))];
  const lv: Levers = { ...ZERO };
  for (const part of (q.get('lv') ?? '').split('.')) {
    const x = /^([a-z])(-?\d{1,3})$/.exec(part);
    if (x && CODE_LEVER[x[1]]) lv[CODE_LEVER[x[1]]] = Math.max(-60, Math.min(60, Number(x[2])));
  }
  let ballot: Record<string, string> | undefined;
  const b = q.get('b');
  if (b && b.length === BALLOT.length) {
    ballot = {};
    BALLOT.forEach((x, i) => { const k = Number(b[i]); if (b[i] !== '-' && x.values[k]) ballot![x.key] = x.values[k]; });
  }
  const by = q.get('by');
  return { level: d.id, goal: d.goal, ids, lv, gradual: q.get('ph') !== '0', by: by ? cleanName(by) || undefined : undefined, ballot };
}

/** Where a channel tag goes on links the player shares (`s`), so a later count can tell channels apart. */
export function planLink(p: SharedPlan, channel?: string, path = '') {
  const q = encodePlan(p);
  return `${siteRoot()}${path}?${q}${channel ? `&s=${channel}` : ''}`;
}

/** The site's root URL, ending in a slash. */
export const siteRoot = () => SITE_URL.replace(/index\.html$/, '').replace(/([^/])$/, '$1/');

/** Just the plan (cards, across-the-board changes, phase-in): what the server stores for a short link. */
export const planCode = (p: Omit<SharedPlan, 'by' | 'ballot'>) => encodePlan({ ...p, by: undefined, ballot: undefined });

/** A short link (?plan=<id>). The name and the answers to the big questions stay in the link, never on the server. */
export function shortLink(id: string, p: Pick<SharedPlan, 'by' | 'ballot'>, path = '') {
  const extra = new URLSearchParams(encodePlan({ level: DESK[0].id, goal: DESK[0].goal, ids: [], lv: { ...ZERO }, gradual: true, by: p.by, ballot: p.ballot }));
  extra.delete('p');
  const rest = extra.toString();
  return `${siteRoot()}${path}?plan=${id}${rest ? '&' + rest : ''}`;
}

// The player's first name, if they gave one: kept in this browser, and sent only inside the links
// they share themselves (a challenge, a chain, a card). Pages that show it listen for changes.
export const myName = () => load<string>('name', '');
export const setMyName = (n: string) => {
  const v = cleanName(n);
  if (v === myName()) return;
  save('name', v);
  window.dispatchEvent(new Event('ftd-name'));
};
const onName = (f: () => void) => { window.addEventListener('ftd-name', f); return () => window.removeEventListener('ftd-name', f); };
/** The player's name, kept current when they change it anywhere in the game. */
export const useMyName = () => useSyncExternalStore(onName, myName, () => '');

/** The player's answers to the big questions, from their saved choices. */
export const ballotFrom = (choices: Record<string, string>) => Object.fromEntries(BALLOT.filter((x) => choices[x.key]).map((x) => [x.key, choices[x.key]]));

// ---------- comparing two players ----------
export interface Agreement {
  agree: number;
  of: number;
  bothCards: string[];
  onlyMine: string[];
  onlyTheirs: string[];
  sameAnswers: { question: string; answer: string }[];
  differentAnswers: { question: string; mine: string; theirs: string }[];
}

/**
 * Agreement counts each decision either player made: a card either of them played (agree when
 * both played it) and each big question both answered (agree when the answers match).
 */
export function compare(mine: { ids: string[]; ballot?: Record<string, string> }, theirs: { ids: string[]; ballot?: Record<string, string> }): Agreement {
  const A = new Set(mine.ids), B = new Set(theirs.ids);
  const bothCards = [...A].filter((x) => B.has(x));
  const onlyMine = [...A].filter((x) => !B.has(x));
  const onlyTheirs = [...B].filter((x) => !A.has(x));
  const sameAnswers: Agreement['sameAnswers'] = [];
  const differentAnswers: Agreement['differentAnswers'] = [];
  for (const q of BALLOT) {
    const a = mine.ballot?.[q.key], b = theirs.ballot?.[q.key];
    if (!a || !b) continue;
    const label = (v: string) => q.labels[q.values.indexOf(v)] ?? v;
    if (a === b) sameAnswers.push({ question: q.question, answer: label(a) });
    else differentAnswers.push({ question: q.question, mine: label(a), theirs: label(b) });
  }
  const agree = bothCards.length + sameAnswers.length;
  const of = bothCards.length + onlyMine.length + onlyTheirs.length + sameAnswers.length + differentAnswers.length;
  return { agree, of, bothCards, onlyMine, onlyTheirs, sameAnswers, differentAnswers };
}

/** The ready-made plan that shares the most cards with this one (Jaccard overlap). */
export function closestPreset(ids: string[]) {
  const A = new Set(ids);
  let best: { id: string; name: string; overlap: number } | null = null;
  for (const p of PRESETS) {
    if (!p.ids?.length) continue;
    const B = new Set(p.ids);
    const inter = [...A].filter((x) => B.has(x)).length;
    const uni = new Set([...A, ...B]).size;
    const overlap = uni ? inter / uni : 0;
    if (!best || overlap > best.overlap) best = { id: p.id, name: p.name, overlap };
  }
  return best && best.overlap > 0 ? best : null;
}

// ---------- the player's budget personality ----------
export interface Archetype { id: string; name: string; line: string }
export const ARCHETYPES: Record<string, Archetype> = {
  'revenue-gentle': { id: 'revenue-gentle', name: 'The Fair-Share Builder', line: 'You closed the gap mostly with revenue, chosen to go easy on the economy. You’d rather ask more of the tax code than cut what people count on.' },
  'revenue-bold': { id: 'revenue-bold', name: 'The Tax Reformer', line: 'You made big changes to the tax code to close the gap fast. Bold, and you kept spending for the programs people count on.' },
  'balanced-gentle': { id: 'balanced-gentle', name: 'The Steady Hand', line: 'You split the load between taxes and spending cuts and phased it in gently, the way most bipartisan deficit commissions have.' },
  'balanced-bold': { id: 'balanced-bold', name: 'The Grand Bargainer', line: 'You went big on both taxes and spending. Everyone gives a little, and the deal gets done.' },
  'spending-gentle': { id: 'spending-gentle', name: 'The Careful Trimmer', line: 'You closed the gap mostly by spending smarter, picking cuts that go easy on the economy. You’d rather trim than raise taxes.' },
  'spending-bold': { id: 'spending-bold', name: 'The Lean-Government Reformer', line: 'You made big cuts to spending to close the gap. Bold, and you kept taxes where they are.' },
};
export function archetype(o: { revenueShare: number; rating: 'gentle' | 'moderate' | 'steep'; cards: number; slidersUsed: boolean }): Archetype {
  // The same thirds the "balance taxes and spending cuts" star uses.
  const lean = o.revenueShare > 2 / 3 + 1e-9 ? 'revenue' : o.revenueShare < 1 / 3 - 1e-9 ? 'spending' : 'balanced';
  const bold = o.rating !== 'gentle' || o.cards >= 8 || o.slidersUsed;
  return ARCHETYPES[`${lean}-${bold ? 'bold' : 'gentle'}`];
}
