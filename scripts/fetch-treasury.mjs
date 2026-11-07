// U.S. Treasury, Bureau of the Fiscal Service — Fiscal Data API (no key required).
// Docs: https://fiscaldata.treasury.gov/api-documentation/
import { getJSON } from './lib/http.mjs';

const BASE = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';

function qs(params) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/** Fetch every page of an endpoint. Returns { rows, url, retrieved }. */
export async function fetchAll(endpoint, params = {}) {
  const rows = [];
  let page = 1;
  let first;
  for (;;) {
    const url = `${BASE}${endpoint}?${qs({ ...params, 'page[size]': 10000, 'page[number]': page })}`;
    const res = await getJSON('treasury', url, { label: endpoint });
    first ??= res;
    rows.push(...res.data.data);
    const totalPages = res.data.meta?.['total-pages'] ?? 1;
    if (page >= totalPages) break;
    page++;
  }
  return { rows, url: first.url.replace(/&page%5Bnumber%5D=\d+/, ''), retrieved: first.retrieved, meta: first.data.meta };
}

export const DATASETS = {
  mts9: {
    endpoint: '/v1/accounting/mts/mts_table_9',
    title: 'Monthly Treasury Statement, Table 9: Summary of Receipts by Source, and Outlays by Function',
    page: 'https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/summary-of-receipts-by-source-and-outlays-by-function-of-the-u-s-government',
  },
  mts5: {
    endpoint: '/v1/accounting/mts/mts_table_5',
    title: 'Monthly Treasury Statement, Table 5: Outlays of the U.S. Government (by agency and account)',
    page: 'https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/outlays-of-the-u-s-government',
  },
  mts4: {
    endpoint: '/v1/accounting/mts/mts_table_4',
    title: 'Monthly Treasury Statement, Table 4: Receipts of the U.S. Government',
    page: 'https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/receipts-of-the-u-s-government',
  },
  mts1: {
    endpoint: '/v1/accounting/mts/mts_table_1',
    title: 'Monthly Treasury Statement, Table 1: Summary of Receipts, Outlays, and the Deficit/Surplus',
    page: 'https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/summary-of-receipts-outlays-and-the-deficit-surplus-of-the-u-s-government',
  },
  mts8: {
    endpoint: '/v1/accounting/mts/mts_table_8',
    title: 'Monthly Treasury Statement, Table 8: Trust Fund Impact on Budget Results and Investment Holdings',
    page: 'https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/trust-fund-impact-on-budget-results-and-investment-holdings',
  },
  penny: {
    endpoint: '/v2/accounting/od/debt_to_penny',
    title: 'Debt to the Penny',
    page: 'https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/debt-to-the-penny',
  },
  debtHist: {
    endpoint: '/v2/accounting/od/debt_outstanding',
    title: 'Historical Debt Outstanding',
    page: 'https://fiscaldata.treasury.gov/datasets/historical-debt-outstanding/historical-debt-outstanding',
  },
  interest: {
    endpoint: '/v2/accounting/od/interest_expense',
    title: 'Interest Expense on the Public Debt Outstanding',
    page: 'https://fiscaldata.treasury.gov/datasets/interest-expense-debt-outstanding/interest-expense-on-the-public-debt-outstanding',
  },
  dtsLimit: {
    endpoint: '/v1/accounting/dts/debt_subject_to_limit',
    title: 'Daily Treasury Statement, Table III-C: Debt Subject to Limit',
    page: 'https://fiscaldata.treasury.gov/datasets/daily-treasury-statement/debt-subject-to-limit',
  },
  rates: {
    endpoint: '/v2/accounting/od/avg_interest_rates',
    title: 'Average Interest Rates on U.S. Treasury Securities',
    page: 'https://fiscaldata.treasury.gov/datasets/average-interest-rates-treasury-securities/average-interest-rates-on-u-s-treasury-securities',
  },
};

export async function fetchTreasury() {
  const out = {};
  console.log('[treasury] MTS table 9 (all months)…');
  out.mts9 = await fetchAll(DATASETS.mts9.endpoint, { sort: 'record_date,src_line_nbr' });
  const dates = [...new Set(out.mts9.rows.map((r) => r.record_date))].sort();
  const septDates = dates.filter((d) => d.slice(5, 7) === '09');
  const latest = dates.at(-1);
  console.log(`[treasury]   ${out.mts9.rows.length} rows, ${dates[0]} → ${latest}`);

  // Agency/account detail for the last three complete fiscal years and the latest month.
  const detailDates = [...new Set([...septDates.slice(-3), latest])];
  out.mts5 = {};
  out.mts4 = {};
  for (const d of detailDates) {
    console.log(`[treasury] MTS tables 4 & 5 for ${d}…`);
    out.mts5[d] = await fetchAll(DATASETS.mts5.endpoint, { filter: `record_date:eq:${d}`, sort: 'src_line_nbr' });
    out.mts4[d] = await fetchAll(DATASETS.mts4.endpoint, { filter: `record_date:eq:${d}`, sort: 'src_line_nbr' });
  }

  console.log('[treasury] MTS table 8 (trust funds), every September…');
  out.mts8 = await fetchAll(DATASETS.mts8.endpoint, { filter: 'record_calendar_month:eq:09', sort: 'record_date,src_line_nbr' });
  console.log(`[treasury]   ${out.mts8.rows.length} rows`);
  console.log('[treasury] Debt to the Penny…');
  out.penny = await fetchAll(DATASETS.penny.endpoint, {
    fields: 'record_date,debt_held_public_amt,intragov_hold_amt,tot_pub_debt_out_amt',
    sort: 'record_date',
  });
  console.log('[treasury] Historical Debt Outstanding…');
  out.debtHist = await fetchAll(DATASETS.debtHist.endpoint, { sort: 'record_date' });
  console.log('[treasury] Interest expense…');
  out.interest = await fetchAll(DATASETS.interest.endpoint, { sort: 'record_date' });
  console.log('[treasury] Average interest rates…');
  out.rates = await fetchAll(DATASETS.rates.endpoint, { sort: 'record_date' });
  console.log('[treasury] Debt subject to limit (Daily Treasury Statement, last 20 days)…');
  out.dtsLimit = await fetchAll(DATASETS.dtsLimit.endpoint, { filter: `record_date:gte:${new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10)}`, sort: '-record_date,src_line_nbr' });
  return out;
}
