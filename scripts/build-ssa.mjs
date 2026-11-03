// Social Security (and Medicare HI) trust funds.
//  History: U.S. Treasury Monthly Treasury Statement, Table 8 (each September's fiscal-year totals
//    and end-of-year balances), for the OASI, DI, and HI trust funds.
//  Projections: the Trustees' 2026 findings in src/data/curated/trustees.json (cited to ssa.gov
//    and cms.gov), because ssa.gov blocks automated downloads.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './lib/http.mjs';
import { DATASETS } from './fetch-treasury.mjs';

const num = (v) => (v == null || v === 'null' || v === '' ? null : Number(v));

export async function buildSSA(addSource) {
  const T = JSON.parse(await readFile(path.join(ROOT, 'data', 'raw', 'treasury.bundle.json'), 'utf8'));
  const trustees = JSON.parse(await readFile(path.join(ROOT, 'src', 'data', 'curated', 'trustees.json'), 'utf8'));
  if (!T.mts8) throw new Error('MTS table 8 missing; run the Treasury fetch');
  const pick = (re) => {
    const out = [];
    for (const r of T.mts8.rows) {
      if (!re.test(r.classification_desc.trim())) continue;
      out.push({
        year: Number(r.record_date.slice(0, 4)),
        income: num(r.fytd_rcpt_amt),
        cost: num(r.fytd_outly_amt),
        reserves: num(r.close_month_acct_bal_amt),
        projected: false,
      });
    }
    return out.sort((a, b) => a.year - b.year);
  };
  const oasi = pick(/^Federal Old-Age and Survivors Insurance$/i);
  const di = pick(/^Federal Disability Insurance$/i);
  const hi = pick(/^Federal Hospital Insurance$/i);
  const oasdi = oasi.map((o) => {
    const d = di.find((x) => x.year === o.year);
    return { year: o.year, income: o.income + (d?.income ?? 0), cost: o.cost + (d?.cost ?? 0), reserves: o.reserves != null && d?.reserves != null ? o.reserves + d.reserves : null, projected: false };
  });
  addSource({ id: 'mts8', title: DATASETS.mts8.title, publisher: 'U.S. Treasury, Bureau of the Fiscal Service', url: DATASETS.mts8.page, retrieved: T.mts8.retrieved });
  console.log(`[build] trust funds FY${oasdi[0].year}–FY${oasdi.at(-1).year}; OASDI reserves end FY${oasdi.at(-1).year}: ${(oasdi.at(-1).reserves / 1e12).toFixed(3)}T`);
  return {
    report: trustees.report,
    released: trustees.released,
    depletion: trustees.depletion,
    payableLongRun: trustees.payableLongRun,
    actuarialDeficit: trustees.actuarialDeficit,
    fixes: trustees.fixes,
    beneficiaries: trustees.beneficiaries,
    oasdi, oasi, di, hi,
    basis: 'fiscal',
    sourceIds: ['mts8', 'ssa-tr2026'],
  };
}
