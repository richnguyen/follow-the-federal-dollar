// Refreshes only the debt limit in src/data/generated/debt.json, from the Daily Treasury
// Statement, between full data runs (npm run data does this too):
//   NODE_USE_ENV_PROXY=1 node scripts/fetch-debt-limit.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAll, DATASETS } from './fetch-treasury.mjs';
import { debtLimitFrom } from './lib/debtlimit.mjs';

const since = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
const res = await fetchAll(DATASETS.dtsLimit.endpoint, { filter: `record_date:gte:${since}`, sort: '-record_date,src_line_nbr' });
const limit = debtLimitFrom(res.rows);
if (!limit) { console.error('No debt-limit figures in the last 20 days of the Daily Treasury Statement.'); process.exit(1); }
const path = new URL('../src/data/generated/debt.json', import.meta.url);
const debt = JSON.parse(readFileSync(path, 'utf8'));
debt.limit = limit;
writeFileSync(path, JSON.stringify(debt, null, 1));
console.log(`debt limit ${(limit.limit / 1e12).toFixed(3)}T, subject to limit ${(limit.subject / 1e12).toFixed(3)}T, as of ${limit.date}`);
