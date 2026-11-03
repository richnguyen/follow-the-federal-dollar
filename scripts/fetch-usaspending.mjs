// USAspending.gov API (Treasury DATA Act data; no key required).
// Docs: https://api.usaspending.gov/docs/endpoints
import { getJSON, pool } from './lib/http.mjs';

const BASE = 'https://api.usaspending.gov/api/v2';

export const AWARD_GROUPS = {
  contracts: { label: 'Contracts', codes: ['A', 'B', 'C', 'D'] },
  grants: { label: 'Grants', codes: ['02', '03', '04', '05'] },
  directPayments: { label: 'Direct payments', codes: ['06', '10'] },
  loans: { label: 'Loans (subsidy cost)', codes: ['07', '08'] },
  other: { label: 'Other assistance', codes: ['09', '11', '-1'] },
};

export const STATES = [
  ['AL', '01', 'Alabama'], ['AK', '02', 'Alaska'], ['AZ', '04', 'Arizona'], ['AR', '05', 'Arkansas'],
  ['CA', '06', 'California'], ['CO', '08', 'Colorado'], ['CT', '09', 'Connecticut'], ['DE', '10', 'Delaware'],
  ['DC', '11', 'District of Columbia'], ['FL', '12', 'Florida'], ['GA', '13', 'Georgia'], ['HI', '15', 'Hawaii'],
  ['ID', '16', 'Idaho'], ['IL', '17', 'Illinois'], ['IN', '18', 'Indiana'], ['IA', '19', 'Iowa'],
  ['KS', '20', 'Kansas'], ['KY', '21', 'Kentucky'], ['LA', '22', 'Louisiana'], ['ME', '23', 'Maine'],
  ['MD', '24', 'Maryland'], ['MA', '25', 'Massachusetts'], ['MI', '26', 'Michigan'], ['MN', '27', 'Minnesota'],
  ['MS', '28', 'Mississippi'], ['MO', '29', 'Missouri'], ['MT', '30', 'Montana'], ['NE', '31', 'Nebraska'],
  ['NV', '32', 'Nevada'], ['NH', '33', 'New Hampshire'], ['NJ', '34', 'New Jersey'], ['NM', '35', 'New Mexico'],
  ['NY', '36', 'New York'], ['NC', '37', 'North Carolina'], ['ND', '38', 'North Dakota'], ['OH', '39', 'Ohio'],
  ['OK', '40', 'Oklahoma'], ['OR', '41', 'Oregon'], ['PA', '42', 'Pennsylvania'], ['RI', '44', 'Rhode Island'],
  ['SC', '45', 'South Carolina'], ['SD', '46', 'South Dakota'], ['TN', '47', 'Tennessee'], ['TX', '48', 'Texas'],
  ['UT', '49', 'Utah'], ['VT', '50', 'Vermont'], ['VA', '51', 'Virginia'], ['WA', '53', 'Washington'],
  ['WV', '54', 'West Virginia'], ['WI', '55', 'Wisconsin'], ['WY', '56', 'Wyoming'],
  ['AS', '60', 'American Samoa'], ['GU', '66', 'Guam'], ['MP', '69', 'Northern Mariana Islands'],
  ['PR', '72', 'Puerto Rico'], ['VI', '78', 'U.S. Virgin Islands'],
];

const fyPeriod = (fy) => [{ start_date: `${fy - 1}-10-01`, end_date: `${fy}-09-30` }];

async function geography(fy, layer, awardCodes) {
  const body = {
    scope: 'place_of_performance',
    geo_layer: layer,
    filters: { time_period: fyPeriod(fy), ...(awardCodes ? { award_type_codes: awardCodes } : {}) },
    subawards: false,
  };
  return getJSON('usaspending', `${BASE}/search/spending_by_geography/`, { body, label: `geo ${layer} ${fy}` });
}

async function category(fy, cat, location, limit = 10) {
  const body = {
    filters: { time_period: fyPeriod(fy), place_of_performance_locations: [location] },
    limit,
    page: 1,
  };
  return getJSON('usaspending', `${BASE}/search/spending_by_category/${cat}/`, { body, label: `${cat} ${JSON.stringify(location)} ${fy}` });
}

export async function fetchUSAspending({ fys, districtDetail = true }) {
  const out = { fys, states: {}, districts: {}, stateDetail: {}, districtDetail: {} };
  for (const fy of fys) {
    console.log(`[usaspending] FY${fy} geography by award type…`);
    out.states[fy] = {};
    out.districts[fy] = {};
    for (const [key, g] of Object.entries(AWARD_GROUPS)) {
      out.states[fy][key] = await geography(fy, 'state', g.codes);
      out.districts[fy][key] = await geography(fy, 'district', g.codes);
    }
  }
  const fy = fys[0];
  console.log(`[usaspending] FY${fy} per-state agencies and programs (${STATES.length} states)…`);
  await pool(STATES, 4, async ([abbr]) => {
    const loc = { country: 'USA', state: abbr };
    const [agencies, programs] = await Promise.all([
      category(fy, 'awarding_agency', loc, 12),
      category(fy, 'cfda', loc, 12),
    ]);
    out.stateDetail[abbr] = { agencies, programs };
  });
  if (districtDetail) {
    // District list comes from the FY geography response; fetch top programs per district.
    const codes = new Set();
    for (const g of Object.values(out.districts[fy])) for (const r of g.data.results ?? []) codes.add(r.shape_code);
    const byFips = Object.fromEntries(STATES.map(([a, f]) => [f, a]));
    const list = [...codes].filter((c) => c && c.length === 4 && byFips[c.slice(0, 2)]);
    console.log(`[usaspending] FY${fy} top programs for ${list.length} districts…`);
    await pool(list, 4, async (code) => {
      const loc = { country: 'USA', state: byFips[code.slice(0, 2)], district_original: code.slice(2) };
      try {
        out.districtDetail[code] = { programs: await category(fy, 'cfda', loc, 6), agencies: await category(fy, 'awarding_agency', loc, 6) };
      } catch (e) {
        console.warn(`[usaspending]   district ${code}: ${e.message}`);
      }
    });
  }
  return out;
}
