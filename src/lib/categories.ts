import type { CategoryId, RevenueId } from '../data/types';

// Spending categories used across the app. Order is the validated color order
// (Social Security → Medicare → Health → Income security → Veterans → Other → Defense → Net interest)
// and is also the stacking order in every chart.
export interface Category {
  id: CategoryId;
  label: string;
  short: string;
  color: string; // CSS var
  bucket: 'mandatory' | 'discretionary' | 'interest' | 'mixed';
  functions: string[]; // OMB budget function codes
  blurb: string;
}

export const CATEGORIES: Category[] = [
  {
    id: 'ss', label: 'Social Security', short: 'Social Security', color: 'var(--c-ss)', bucket: 'mandatory', functions: ['650'],
    blurb: 'Monthly retirement, survivor, and disability checks.',
  },
  {
    id: 'medicare', label: 'Medicare', short: 'Medicare', color: 'var(--c-medicare)', bucket: 'mandatory', functions: ['570'],
    blurb: 'Health insurance for people 65 and older and some people with disabilities.',
  },
  {
    id: 'health', label: 'Medicaid & other health', short: 'Health', color: 'var(--c-health)', bucket: 'mixed', functions: ['550'],
    blurb: 'Medicaid, CHIP, ACA marketplace subsidies, NIH research, CDC, FDA.',
  },
  {
    id: 'income', label: 'Income security', short: 'Income security', color: 'var(--c-income)', bucket: 'mixed', functions: ['600'],
    blurb: 'SNAP food aid, SSI, tax credits paid as refunds, unemployment, housing aid, federal retirement.',
  },
  {
    id: 'veterans', label: 'Veterans benefits', short: 'Veterans', color: 'var(--c-veterans)', bucket: 'mixed', functions: ['700'],
    blurb: 'Disability compensation, VA hospitals and clinics, GI Bill education.',
  },
  {
    id: 'other', label: 'Everything else', short: 'Everything else', color: 'var(--c-other)', bucket: 'mixed',
    functions: ['150', '250', '270', '300', '350', '370', '400', '450', '500', '750', '800', '950'],
    blurb: 'Education, highways, science, foreign aid, courts, farms, the environment, and the rest of government.',
  },
  {
    id: 'defense', label: 'National defense', short: 'Defense', color: 'var(--c-defense)', bucket: 'discretionary', functions: ['050'],
    blurb: 'The Pentagon, troops’ pay, weapons, and the Energy Department’s nuclear weapons work.',
  },
  {
    id: 'interest', label: 'Net interest on the debt', short: 'Net interest', color: 'var(--c-interest)', bucket: 'interest', functions: ['900'],
    blurb: 'Interest paid to people and institutions that lent the government money.',
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, Category>;

export const FUNCTION_TO_CATEGORY: Record<string, CategoryId> = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.functions.map((f) => [f, c.id])),
);

// CBO's budget-concept groups (mandatory / discretionary / interest), in validated color order.
export const BUCKETS = [
  { id: 'socialSecurity', label: 'Social Security', color: 'var(--c-ss)', group: 'mandatory' },
  { id: 'medicare', label: 'Medicare', color: 'var(--c-medicare)', group: 'mandatory' },
  { id: 'medicaid', label: 'Medicaid', color: 'var(--c-health)', group: 'mandatory' },
  { id: 'otherMandatory', label: 'Other mandatory', color: 'var(--c-income)', group: 'mandatory' },
  { id: 'defense', label: 'Defense', color: 'var(--c-defense)', group: 'discretionary' },
  { id: 'nondefense', label: 'Non-defense', color: 'var(--c-other)', group: 'discretionary' },
  { id: 'netInterest', label: 'Net interest', color: 'var(--c-interest)', group: 'interest' },
] as const;

export type BucketId = (typeof BUCKETS)[number]['id'];

export interface RevenueCat { id: RevenueId; label: string; color: string; blurb: string }
// Revenue sources (their own entity set; same validated order).
export const REVENUE: RevenueCat[] = [
  { id: 'individual', label: 'Individual income taxes', color: 'var(--c-ss)', blurb: 'Taxes on wages, salaries, investment income, and business profits that pass through to owners.' },
  { id: 'payroll', label: 'Payroll taxes', color: 'var(--c-medicare)', blurb: 'Social Security and Medicare taxes withheld from paychecks, plus unemployment insurance. Most of it is set aside in trust funds.' },
  { id: 'corporate', label: 'Corporate income taxes', color: 'var(--c-health)', blurb: 'Tax on the profits of C corporations, at a 21% rate since 2018.' },
  { id: 'customs', label: 'Customs duties (tariffs)', color: 'var(--c-income)', blurb: 'Taxes on imported goods, collected at the border and paid by the importing business.' },
  { id: 'excise', label: 'Excise taxes', color: 'var(--c-veterans)', blurb: 'Per-unit taxes on gasoline, diesel, airline tickets, alcohol, and tobacco. Most fund highways and aviation.' },
  { id: 'estate', label: 'Estate & gift taxes', color: 'var(--c-other)', blurb: 'Tax on very large inheritances and gifts.' },
  { id: 'misc', label: 'Everything else', color: 'var(--c-defense)', blurb: 'Federal Reserve earnings sent to Treasury, fees, fines, and other receipts.' },
];
export const REVENUE_BY_ID = Object.fromEntries(REVENUE.map((r) => [r.id, r])) as Record<RevenueId, RevenueCat>;
