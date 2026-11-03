// Congressional Budget Office — historical budget data and the current 10-year baseline.
// Index page: https://www.cbo.gov/data/budget-economic-data
import { getFile, ROOT, RAW } from './lib/http.mjs';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const INDEX = 'https://www.cbo.gov/data/budget-economic-data';

// Which spreadsheets we want, matched against link text/href on CBO's index page.
const WANT = [
  { key: 'historical', re: /Historical-Budget-Data\.xlsx/i },
  { key: 'projections', re: /Budget-Projections\.xlsx/i },
  { key: 'economic', re: /(10-Year-Economic-Projections|Economic-Projections)\.xlsx/i },
  { key: 'revenue', re: /Revenue-Projections\.xlsx/i },
];

export async function fetchCBO() {
  const indexFile = await getFile('cbo', INDEX, 'index.html');
  const html = await readFile(indexFile, 'utf8');
  const links = [...html.matchAll(/href="([^"]+\.xlsx)"/gi)].map((m) => new URL(m[1], INDEX).href);
  const found = {};
  for (const w of WANT) {
    // CBO lists newest first; take the first match.
    const url = links.find((l) => w.re.test(l));
    if (!url) { console.warn(`[cbo] no link found for ${w.key}`); continue; }
    const name = `${w.key}.xlsx`;
    console.log(`[cbo] ${w.key}: ${url}`);
    const file = await getFile('cbo', url, name);
    const json = file.replace(/\.xlsx$/, '.sheets.json');
    execFileSync('python3', ['-I', path.join(ROOT, 'scripts', 'xlsx_to_json.py'), file, json], { stdio: 'inherit' });
    found[w.key] = { url, file, json };
  }
  return found;
}
