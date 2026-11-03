// U.S. Census Bureau: national population and number of households, for per-person and
// per-household framing. (The Census data API now requires a key, so this reads the Bureau's
// own published releases on www.census.gov instead.)
//  - Population: Vintage 2025 national estimate press release (July 1, 2025).
//  - Households: Housing Vacancies and Homeownership (CPS/HVS) quarterly release, Table 3,
//    occupied housing units (each occupied unit is one household).
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getFile, ROOT, writeJSON } from './lib/http.mjs';

const POP_URL = 'https://www.census.gov/newsroom/press-releases/2026/population-growth-slows.html';
const HVS_URL = 'https://www.census.gov/housing/hvs/files/currenthvspress.pdf';

const text = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

export async function fetchCensus() {
  const popFile = await getFile('census', POP_URL, 'vintage2025-national.html');
  const popText = text(await readFile(popFile, 'utf8'));
  const pm = popText.match(/to reach ([\d.]+) million/i);
  if (!pm) throw new Error('population figure not found in Census release');
  const pop = Math.round(Number(pm[1]) * 1e6);

  const hvsFile = await getFile('census', HVS_URL, 'hvs-current.pdf');
  const hvsTxt = execFileSync('pdftotext', ['-layout', hvsFile, '-'], { encoding: 'utf8' });
  const quarter = hvsTxt.match(/(FIRST|SECOND|THIRD|FOURTH) QUARTER (\d{4})/i);
  const occ = hvsTxt.match(/\.\.Occupied[.\s]+([\d,]+)\s+([\d,]+)/);
  if (!occ || !quarter) throw new Error('occupied housing units not found in HVS release');
  const hh = Number(occ[2].replace(/,/g, '')) * 1000; // thousands; second column is the current quarter
  const q = `${quarter[1][0]}${quarter[1].slice(1).toLowerCase()} quarter ${quarter[2]}`;
  const out = {
    population: { value: pop, label: `${(pop / 1e6).toFixed(1)} million residents on July 1, 2025 (Census Bureau, Vintage 2025 estimates)`, sourceId: 'census-pop' },
    households: { value: hh, label: `${(hh / 1e6).toFixed(1)} million occupied homes, ${q} (Census Bureau, Housing Vacancy Survey)`, sourceId: 'census-hvs' },
    sources: [
      { id: 'census-pop', title: 'Vintage 2025 national population estimate (press release)', publisher: 'U.S. Census Bureau', url: POP_URL, retrieved: new Date().toISOString() },
      { id: 'census-hvs', title: `Quarterly Residential Vacancies and Homeownership, ${q}, Table 3 (occupied housing units)`, publisher: 'U.S. Census Bureau', url: HVS_URL, retrieved: new Date().toISOString() },
    ],
  };
  await writeJSON('data/raw/census.bundle.json', out);
  console.log(`[census] population ${pop.toLocaleString()}, households ${hh.toLocaleString()} (${q})`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) await fetchCensus();
void path; void ROOT;
