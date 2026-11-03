// Transforms cached raw responses (data/raw/) into the app's JSON (src/data/generated/).
// Run `npm run data` to fetch + build, or `npm run data:build` to rebuild from cache.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, writeJSON } from './lib/http.mjs';
import { DATASETS } from './fetch-treasury.mjs';
import { STATES } from './fetch-usaspending.mjs';
import { buildCBO } from './build-cbo.mjs';
import { buildSSA } from './build-ssa.mjs';

const raw = async (f) => JSON.parse(await readFile(path.join(ROOT, 'data', 'raw', f), 'utf8'));
const num = (v) => (v == null || v === '' || v === 'null' ? null : Number(v));
const sources = [];
const addSource = (s) => { if (!sources.find((x) => x.id === s.id)) sources.push(s); };

// ---------------------------------------------------------------- Treasury
const T = await raw('treasury.bundle.json');

const FUNCTION_CODES = [
  [/^national defense/i, '050'], [/^international affairs/i, '150'], [/^general science/i, '250'], [/^energy$/i, '270'],
  [/^natural resources/i, '300'], [/^agriculture/i, '350'], [/^commerce and housing/i, '370'], [/^transportation/i, '400'],
  [/^community and regional/i, '450'], [/^education, training/i, '500'], [/^health$/i, '550'], [/^medicare$/i, '570'],
  [/^income security/i, '600'], [/^social security$/i, '650'], [/^veterans benefits/i, '700'], [/^administration of justice/i, '750'],
  [/^general government/i, '800'], [/^net interest/i, '900'], [/^undistributed offsetting receipts/i, '950'],
];
const FUNCTION_CATEGORY = {
  '050': 'defense', '550': 'health', '570': 'medicare', '600': 'income', '650': 'ss', '700': 'veterans', '900': 'interest', '950': 'offset',
};
const RECEIPT_IDS = [
  [/^individual income taxes/i, 'individual', 'Individual income taxes'],
  [/^corporation income taxes/i, 'corporate', 'Corporation income taxes'],
  [/^social insurance and retirement receipts/i, 'payroll', 'Social insurance and retirement receipts'],
  [/^excise taxes/i, 'excise', 'Excise taxes'],
  [/^estate and gift taxes/i, 'estate', 'Estate and gift taxes'],
  [/^customs duties/i, 'customs', 'Customs duties'],
  [/^miscellaneous receipts/i, 'misc', 'Miscellaneous receipts'],
];

// Detect units: the full-year outlays must be in the trillions of dollars.
function unitScale(rows) {
  const tot = rows.find((r) => r.record_type_cd === 'SL' && r.data_type_cd === 'T' && r.record_date.slice(5, 7) === '09' && Number(r.src_line_nbr) > 20);
  const v = Math.abs(num(tot?.current_fytd_rcpt_outly_amt) ?? 0);
  if (v > 1e12) return 1;
  if (v > 1e6) return 1e6;
  throw new Error('cannot detect MTS units: ' + v);
}
const S9 = unitScale(T.mts9.rows);
const fyOf = (d) => Number(d.slice(0, 4)) + (Number(d.slice(5, 7)) >= 10 ? 1 : 0);
const fmOf = (d) => ((Number(d.slice(5, 7)) + 2) % 12) + 1; // Oct=1 … Sep=12

const byDate = new Map();
for (const r of T.mts9.rows) {
  if (!byDate.has(r.record_date)) byDate.set(r.record_date, []);
  byDate.get(r.record_date).push(r);
}

/** Parse one MTS Table 9 publication into receipts by source, outlays by function, totals. */
function parse9(rows, col) {
  rows = [...rows].sort((a, b) => Number(a.src_line_nbr) - Number(b.src_line_nbr));
  const childrenOf = (id) => rows.filter((r) => r.parent_id === id);
  const amt = (r) => {
    const v = num(r[col]);
    if (v != null) return v * S9;
    const kids = childrenOf(r.classification_id);
    return kids.length ? kids.reduce((s, k) => s + (amt(k) ?? 0), 0) : null;
  };
  // Sections are top-level header rows ("Receipts", "Net Outlays"); each ends with a "Total" child.
  const recHead = rows.find((r) => r.parent_id === 'null' || r.parent_id == null ? /^receipts$/i.test(r.classification_desc.trim()) : false);
  const outHead = rows.find((r) => (r.parent_id === 'null' || r.parent_id == null) && /outlays$/i.test(r.classification_desc.trim()));
  if (!recHead || !outHead) throw new Error('MTS9: section headers not found for ' + rows[0]?.record_date);
  const receipts = [];
  const functions = [];
  let totalReceipts = null;
  let totalOutlays = null;
  for (const r of childrenOf(recHead.classification_id)) {
    const name = r.classification_desc.trim();
    if (/^total/i.test(name)) { totalReceipts = amt(r); continue; }
    const m = RECEIPT_IDS.find(([re]) => re.test(name));
    if (!m) throw new Error('MTS9: unknown receipt line ' + name);
    receipts.push({ id: m[1], name: m[2], amount: amt(r) ?? 0 });
  }
  for (const r of childrenOf(outHead.classification_id)) {
    const name = r.classification_desc.trim();
    if (/^total/i.test(name)) { totalOutlays = amt(r); continue; }
    const m = FUNCTION_CODES.find(([re]) => re.test(name));
    if (!m) throw new Error('MTS9: unknown function line ' + name);
    const prev = functions.find((x) => x.code === m[1]);
    if (prev) prev.amount += amt(r) ?? 0;
    else functions.push({ code: m[1], name, amount: amt(r) ?? 0, category: FUNCTION_CATEGORY[m[1]] ?? 'other' });
  }
  return { receipts, functions, totalReceipts, totalOutlays };
}

const dates = [...byDate.keys()].sort();
const monthly = [];
const monthlyBySource = [];
const annual = [];
const functionsByFY = {};
const receiptsByFY = {};
for (const d of dates) {
  const m = parse9(byDate.get(d), 'current_month_rcpt_outly_amt');
  if (m.totalReceipts != null && m.totalOutlays != null) {
    monthly.push({ date: d, fy: fyOf(d), fm: fmOf(d), receipts: m.totalReceipts, outlays: m.totalOutlays, deficit: m.totalOutlays - m.totalReceipts });
    monthlyBySource.push({ date: d, fy: fyOf(d), fm: fmOf(d), values: Object.fromEntries(m.receipts.map((r) => [r.id, r.amount])) });
  }
  if (d.slice(5, 7) === '09') {
    const y = parse9(byDate.get(d), 'current_fytd_rcpt_outly_amt');
    const fy = fyOf(d);
    annual.push({ fy, receipts: y.totalReceipts, outlays: y.totalOutlays, deficit: y.totalOutlays - y.totalReceipts });
    functionsByFY[fy] = y.functions;
    receiptsByFY[fy] = y.receipts;
  }
}
const latestDate = dates.at(-1);
const latestFY = annual.at(-1).fy;
let partialFY = null;
if (latestDate.slice(5, 7) !== '09') {
  const y = parse9(byDate.get(latestDate), 'current_fytd_rcpt_outly_amt');
  partialFY = { fy: fyOf(latestDate), through: latestDate, receipts: y.totalReceipts, outlays: y.totalOutlays, deficit: y.totalOutlays - y.totalReceipts };
}
// Sanity: function totals must reproduce the total outlays line.
for (const a of annual) {
  const sum = functionsByFY[a.fy].reduce((s, f) => s + f.amount, 0);
  if (Math.abs(sum - a.outlays) > 1e9) console.warn(`[build] FY${a.fy} functions sum ${sum} ≠ total outlays ${a.outlays}`);
  const rs = receiptsByFY[a.fy].reduce((s, f) => s + f.amount, 0);
  if (Math.abs(rs - a.receipts) > 1e9) console.warn(`[build] FY${a.fy} receipts sum ${rs} ≠ total receipts ${a.receipts}`);
}
addSource({ id: 'mts9', title: DATASETS.mts9.title, publisher: 'U.S. Treasury, Bureau of the Fiscal Service', url: DATASETS.mts9.page, retrieved: T.mts9.retrieved, note: `API: ${T.mts9.url.split('?')[0]}` });

// ---- MTS Table 5: agency → bureau → account tree for the latest complete FY (+ prior for comparison)
function tree5(res) {
  const rows = [...res.rows].sort((a, b) => Number(a.src_line_nbr) - Number(b.src_line_nbr));
  const S = S9;
  const col = 'current_fytd_net_outly_amt';
  const byId = new Map(rows.map((r) => [r.classification_id, r]));
  const kids = new Map();
  for (const r of rows) {
    if (!kids.has(r.parent_id)) kids.set(r.parent_id, []);
    kids.get(r.parent_id).push(r);
  }
  const isTotal = (r) => /^total/i.test(r.classification_desc.trim()) || r.data_type_cd === 'T';
  const build = (r, depth = 0) => {
    const ch = (kids.get(r.classification_id) ?? []).filter((c) => !isTotal(c));
    const children = ch.map((c) => build(c, depth + 1)).filter((n) => n.amount !== 0 || (n.children?.length ?? 0) > 0);
    const own = num(r[col]);
    const amount = own != null ? own * S : children.reduce((s, c) => s + c.amount, 0);
    const node = { name: r.classification_desc.trim().replace(/:$/, ''), amount };
    if (children.length) node.children = children;
    return node;
  };
  const topRows = rows.filter((r) => !byId.has(r.parent_id) && !isTotal(r));
  const root = { name: 'All agencies', amount: 0, children: topRows.map((r) => build(r)).filter((n) => n.amount !== 0) };
  root.amount = root.children.reduce((s, c) => s + c.amount, 0);
  return root;
}
const septDates = Object.keys(T.mts5).filter((d) => d.slice(5, 7) === '09').sort();
const accDate = septDates.at(-1);
const accRoot = tree5(T.mts5[accDate]);
const priorDate = septDates.at(-2);
if (priorDate) {
  const prior = tree5(T.mts5[priorDate]);
  const index = new Map();
  const walk = (n, p) => { const k = p + '|' + n.name; index.set(k, n.amount); (n.children ?? []).forEach((c) => walk(c, k)); };
  prior.children.forEach((c) => walk(c, ''));
  const attach = (n, p) => { const k = p + '|' + n.name; if (index.has(k)) n.prior = index.get(k); (n.children ?? []).forEach((c) => attach(c, k)); };
  accRoot.children.forEach((c) => attach(c, ''));
}
console.log(`[build] MTS5 FY${fyOf(accDate)}: ${accRoot.children.length} agencies, total ${(accRoot.amount / 1e12).toFixed(3)}T`);
addSource({ id: 'mts5', title: DATASETS.mts5.title, publisher: 'U.S. Treasury, Bureau of the Fiscal Service', url: DATASETS.mts5.page, retrieved: T.mts5[accDate].retrieved });

// ---- MTS Table 4: social insurance receipts detail
const payroll = [];
{
  // One row per trust fund / program, from the "Total -- …" lines (railroad retirement has none).
  const rows = [...T.mts4[accDate].rows].sort((a, b) => Number(a.src_line_nbr) - Number(b.src_line_nbr));
  const LABELS = [
    [/Old-Age and Survivors Insurance/i, 'Social Security retirement & survivors (OASI)'],
    [/Disability Insurance/i, 'Social Security disability (DI)'],
    [/Hospital Insurance/i, 'Medicare hospital insurance (HI)'],
    [/Unemployment Insurance/i, 'Unemployment insurance'],
    [/Other Retirement/i, 'Federal employee retirement contributions'],
  ];
  for (const r of rows) {
    const name = r.classification_desc.trim();
    if (!/^Total --/.test(name)) continue;
    const m = LABELS.find(([re]) => re.test(name));
    if (m) payroll.push({ name: m[1], amount: num(r.current_fytd_net_rcpt_amt) * S9 });
  }
  const rail = rows.find((r) => /^Railroad Retirement:?$/i.test(r.classification_desc.trim()));
  if (rail) {
    const amt = rows.filter((r) => r.parent_id === rail.classification_id).reduce((s, r) => s + (num(r.current_fytd_net_rcpt_amt) ?? 0), 0) * S9;
    payroll.push({ name: 'Railroad retirement', amount: amt });
  }
  payroll.sort((a, b) => b.amount - a.amount);
  const tot = rows.find((r) => /^Total -- Social Insurance/i.test(r.classification_desc.trim()));
  const sum = payroll.reduce((s, p) => s + p.amount, 0);
  if (tot && Math.abs(sum - num(tot.current_fytd_net_rcpt_amt) * S9) > 1e9) console.warn('[build] payroll detail does not sum to total');
  addSource({ id: 'mts4', title: DATASETS.mts4.title, publisher: 'U.S. Treasury, Bureau of the Fiscal Service', url: DATASETS.mts4.page, retrieved: T.mts4[accDate].retrieved });
}

// ---- Customs duties: gross collections vs refunds (MTS Table 4), each complete FY
const customs = Object.keys(T.mts4).filter((d) => d.slice(5, 7) === '09').sort().map((d) => {
  const r = T.mts4[d].rows.find((x) => /^customs duties/i.test(x.classification_desc.trim()));
  return { fy: fyOf(d), gross: num(r.current_fytd_gross_rcpt_amt) * S9, refunds: num(r.current_fytd_refund_amt) * S9, net: num(r.current_fytd_net_rcpt_amt) * S9 };
});

// ---------------------------------------------------------------- Debt
const penny = T.penny.rows.map((r) => ({ date: r.record_date, total: num(r.tot_pub_debt_out_amt), public: num(r.debt_held_public_amt), intragov: num(r.intragov_hold_amt) })).filter((r) => r.total);
const monthEnd = [];
for (const r of penny) {
  const last = monthEnd.at(-1);
  if (last && last.date.slice(0, 7) === r.date.slice(0, 7)) monthEnd[monthEnd.length - 1] = r;
  else monthEnd.push(r);
}
const hist = T.debtHist.rows
  .map((r) => ({ fy: Number(r.record_fiscal_year ?? r.record_date.slice(0, 4)), total: num(r.debt_outstanding_amt) }))
  .filter((r) => r.total)
  .sort((a, b) => a.fy - b.fy);
// Add the latest FY from Debt to the Penny if the historical table lags.
const lastSep = [...penny].reverse().find((r) => r.date.slice(5, 7) === '09');
if (lastSep && !hist.find((h) => h.fy === Number(lastSep.date.slice(0, 4)))) hist.push({ fy: Number(lastSep.date.slice(0, 4)), total: lastSep.total });
const byFY = hist.map((h, i) => ({ fy: h.fy, total: h.total, change: i > 0 && hist[i - 1].fy === h.fy - 1 ? h.total - hist[i - 1].total : null }));
const interestByFY = [];
{
  const sept = T.interest.rows.filter((r) => r.record_date.slice(5, 7) === '09');
  const fys = [...new Set(sept.map((r) => fyOf(r.record_date)))].sort();
  for (const fy of fys) {
    const rows = sept.filter((r) => fyOf(r.record_date) === fy);
    const gross = rows.reduce((s, r) => s + (num(r.fytd_expense_amt) ?? 0), 0);
    interestByFY.push({ fy, gross });
  }
}
const rates = [];
{
  const g = new Map();
  for (const r of T.rates.rows) {
    const k = r.record_date;
    if (!g.has(k)) g.set(k, {});
    const desc = (r.security_desc ?? '').trim();
    if (/^total marketable$/i.test(desc)) g.get(k).marketable = num(r.avg_interest_rate_amt);
    if (/^total interest-bearing debt$/i.test(desc)) g.get(k).total = num(r.avg_interest_rate_amt);
  }
  for (const [date, v] of [...g.entries()].sort()) if (v.marketable != null) rates.push({ date, marketable: v.marketable, total: v.total ?? v.marketable });
}
const debt = { latest: penny.at(-1), series: monthEnd, byFY, interestByFY, rates };
addSource({ id: 'penny', title: DATASETS.penny.title, publisher: 'U.S. Treasury, Bureau of the Fiscal Service', url: DATASETS.penny.page, retrieved: T.penny.retrieved });
addSource({ id: 'debtHist', title: DATASETS.debtHist.title, publisher: 'U.S. Treasury, Bureau of the Fiscal Service', url: DATASETS.debtHist.page, retrieved: T.debtHist.retrieved });
addSource({ id: 'interest', title: DATASETS.interest.title, publisher: 'U.S. Treasury, Bureau of the Fiscal Service', url: DATASETS.interest.page, retrieved: T.interest.retrieved });
addSource({ id: 'rates', title: DATASETS.rates.title, publisher: 'U.S. Treasury, Bureau of the Fiscal Service', url: DATASETS.rates.page, retrieved: T.rates.retrieved });

// ---------------------------------------------------------------- USAspending
const U = await raw('usaspending.bundle.json').catch(() => null);
let geo = null;
if (U) {
const GEO_FY = U.fys[0];
const PRIOR_FY = U.fys[1] ?? null;
const TYPES = ['contracts', 'grants', 'directPayments', 'loans', 'other'];
function geoRows(fy, layer) {
  const out = new Map();
  for (const t of TYPES) {
    const res = (layer === 'state' ? U.states : U.districts)[fy][t];
    for (const r of res.data.results ?? []) {
      const k = r.shape_code;
      if (!k) continue;
      if (!out.has(k)) out.set(k, { code: k, name: r.display_name, population: r.population ?? null, byType: Object.fromEntries(TYPES.map((x) => [x, 0])) });
      const o = out.get(k);
      o.byType[t] += Number(r.aggregated_amount ?? 0);
      o.population ??= r.population ?? null;
    }
  }
  for (const o of out.values()) o.total = TYPES.reduce((s, t) => s + o.byType[t], 0);
  return out;
}
const st = geoRows(GEO_FY, 'state');
const stPrior = PRIOR_FY ? geoRows(PRIOR_FY, 'state') : new Map();
const states = [];
for (const [abbr, fips, name] of STATES) {
  const o = st.get(abbr);
  if (!o) { console.warn('[build] no USAspending row for', abbr); continue; }
  const det = U.stateDetail[abbr];
  states.push({
    abbr, fips, name, population: o.population ?? 0, total: o.total, perCapita: o.population ? o.total / o.population : 0, byType: o.byType,
    agencies: (det?.agencies.data.results ?? []).map((a) => ({ name: a.name, amount: a.amount })),
    programs: (det?.programs.data.results ?? []).map((p) => ({ code: p.code, name: p.name, amount: p.amount })),
    priorTotal: stPrior.get(abbr)?.total,
  });
}
const byFips = Object.fromEntries(STATES.map(([a, f]) => [f, a]));
const dist = geoRows(GEO_FY, 'district');
const districts = [];
for (const o of dist.values()) {
  const code = o.code;
  const state = byFips[code.slice(0, 2)];
  if (!state || code.length !== 4) continue;
  const det = U.districtDetail[code];
  const n = code.slice(2);
  districts.push({
    code, state, label: n === '00' || n === '98' ? `${state} at-large` : `${state}-${n}`,
    population: o.population ?? 0, total: o.total, perCapita: o.population ? o.total / o.population : 0, byType: o.byType,
    programs: det?.programs?.data.results?.map((p) => ({ code: p.code, name: p.name, amount: p.amount })),
    agencies: det?.agencies?.data.results?.map((a) => ({ name: a.name, amount: a.amount })),
  });
}
const natPop = states.reduce((s, x) => s + (x.population || 0), 0);
const natTotal = states.reduce((s, x) => s + x.total, 0);
geo = { fy: GEO_FY, states, districts, national: { total: natTotal, population: natPop, perCapita: natTotal / natPop }, priorFY: PRIOR_FY };
const geoReq = U.states[GEO_FY].grants;
addSource({ id: 'usaspending-geo', title: 'Spending by Geography (award obligations by state and congressional district)', publisher: 'USAspending.gov (U.S. Treasury)', url: 'https://www.usaspending.gov/search', retrieved: geoReq.retrieved, note: 'API: /api/v2/search/spending_by_geography/' });
addSource({ id: 'usaspending-cat', title: 'Spending by Category (awarding agency, assistance listing)', publisher: 'USAspending.gov (U.S. Treasury)', url: 'https://www.usaspending.gov/search', retrieved: geoReq.retrieved, note: 'API: /api/v2/search/spending_by_category/' });
} else console.warn('[build] USAspending bundle missing; keeping existing geo.json');

// ---------------------------------------------------------------- CBO, SSA, population
const cbo = await buildCBO(addSource);
const ssa = await buildSSA(addSource).catch((e) => { console.warn('[build] SSA skipped: ' + e.message); return null; });
const census = await raw('census.bundle.json');
const population = census.population;
const households = census.households;
census.sources.forEach(addSource);

const budget = {
  latestFY, partialFY, annual, monthly, functionsByFY, receiptsByFY, monthlyBySource, payroll, customs,
  population, households, mtsLatestDate: latestDate,
};
await writeJSON('src/data/generated/budget.json', budget);
await writeJSON('src/data/generated/accounts.json', { fy: fyOf(accDate), root: accRoot });
await writeJSON('src/data/generated/debt.json', debt);
if (geo) await writeJSON('src/data/generated/geo.json', geo);
await writeJSON('src/data/generated/cbo.json', cbo);
if (ssa) await writeJSON('src/data/generated/ssa.json', ssa);
await writeJSON('src/data/generated/sources.json', sources);
console.log(`[build] FY${latestFY}: receipts ${(annual.at(-1).receipts / 1e12).toFixed(3)}T, outlays ${(annual.at(-1).outlays / 1e12).toFixed(3)}T, deficit ${(annual.at(-1).deficit / 1e12).toFixed(3)}T`);
