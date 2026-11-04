// Runs every fetcher and stores the raw responses under data/raw/ (cached; pass --refresh to refetch).
import { fetchTreasury } from './fetch-treasury.mjs';
import { fetchUSAspending } from './fetch-usaspending.mjs';
import { fetchCBO } from './fetch-cbo.mjs';
import { fetchSSA } from './fetch-ssa.mjs';
import { fetchCensus } from './fetch-census.mjs';
import { writeJSON } from './lib/http.mjs';

const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const want = (k) => !only || only.includes(k);

const manifest = {};
if (want('treasury')) {
  const t = await fetchTreasury();
  await writeJSON('data/raw/treasury.bundle.json', t);
  manifest.treasury = true;
}
if (want('usaspending')) {
  // FY2025 is the latest complete year: agencies are still reporting FY2026 awards.
  const u = await fetchUSAspending({ fys: [2025, 2024] });
  await writeJSON('data/raw/usaspending.bundle.json', u);
  manifest.usaspending = true;
}
if (want('cbo')) manifest.cbo = await fetchCBO();
if (want('ssa')) manifest.ssa = await fetchSSA();
if (want('census')) manifest.census = await fetchCensus();
console.log('done', Object.keys(manifest));
