// Social Security Administration, Office of the Chief Actuary — 2026 Trustees Report and
// historical trust fund operations. https://www.ssa.gov/oact/TR/2026/
import { getFile } from './lib/http.mjs';

export const SSA_PAGES = {
  trIndex: 'https://www.ssa.gov/oact/TR/2026/',
  // Historical operations of the combined OASI and DI Trust Funds (calendar years, $ billions).
  histOASDI: 'https://www.ssa.gov/oact/STATS/table4a3.html',
  histOASI: 'https://www.ssa.gov/oact/STATS/table4a1.html',
  // Trustees Report projection tables (located by name from the index at run time).
};

export async function fetchSSA() {
  const out = {};
  for (const [k, url] of Object.entries(SSA_PAGES)) {
    console.log(`[ssa] ${k}: ${url}`);
    out[k] = await getFile('ssa', url, `${k}.html`);
  }
  return out;
}
