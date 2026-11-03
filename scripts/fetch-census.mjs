// U.S. Census Bureau API: national population and number of households (American Community
// Survey 1-year estimates). Used for the per-person and per-household framing.
import { getJSON, writeJSON } from './lib/http.mjs';

export async function fetchCensus() {
  // Try the newest ACS 1-year release first.
  for (const year of [2025, 2024, 2023]) {
    const url = `https://api.census.gov/data/${year}/acs/acs1?get=NAME,B01003_001E,B11001_001E&for=us:1`;
    try {
      const res = await getJSON('census', url, { retries: 1 });
      const [head, row] = res.data;
      const pop = Number(row[head.indexOf('B01003_001E')]);
      const hh = Number(row[head.indexOf('B11001_001E')]);
      if (!pop || !hh) continue;
      const out = {
        population: { value: pop, label: `${(pop / 1e6).toFixed(1)} million (Census Bureau, ${year} American Community Survey)`, sourceId: 'census-acs' },
        households: { value: hh, label: `${(hh / 1e6).toFixed(1)} million (Census Bureau, ${year} American Community Survey)`, sourceId: 'census-acs' },
        source: {
          id: 'census-acs',
          title: `${year} American Community Survey 1-year estimates: total population (B01003) and households (B11001)`,
          publisher: 'U.S. Census Bureau',
          url: `https://data.census.gov/table?q=B11001&g=010XX00US&y=${year}`,
          retrieved: res.retrieved,
          note: `API: ${url}`,
        },
      };
      await writeJSON('data/raw/census.bundle.json', out);
      console.log(`[census] ACS ${year}: population ${pop}, households ${hh}`);
      return out;
    } catch (e) {
      console.warn(`[census] ACS ${year} unavailable: ${e.message}`);
    }
  }
  throw new Error('no ACS release reachable');
}

if (import.meta.url === `file://${process.argv[1]}`) await fetchCensus();
