// Reports which official data hosts this machine can reach.
const HOSTS = [
  'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?page%5Bsize%5D=1',
  'https://api.usaspending.gov/api/v2/references/toptier_agencies/',
  'https://www.cbo.gov/data/budget-economic-data',
  'https://www.ssa.gov/oact/TR/2026/',
  'https://www.congress.gov/',
  'https://crsreports.congress.gov/',
  'https://www.irs.gov/',
  'https://api.census.gov/data.json',
  'https://www.whitehouse.gov/omb/',
];
let ok = 0;
for (const u of HOSTS) {
  try {
    const r = await fetch(u, { method: 'GET', signal: AbortSignal.timeout(20000) });
    console.log(String(r.status).padEnd(5), new URL(u).host);
    if (r.status < 500) ok++;
  } catch (e) {
    console.log('BLOCK', new URL(u).host, e.cause?.code || e.message);
  }
}
process.exitCode = ok === HOSTS.length ? 0 : 1;
