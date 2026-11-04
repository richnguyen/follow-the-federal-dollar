# Follow the Federal Dollar

A plain-language web app that shows average voters where U.S. federal tax money goes: spending by
purpose and by every agency account, revenue by source, the structural gap between autopilot
spending and revenue, the debt and interest, the laws that changed deficits, how Congress actually
budgets, federal money in each state and congressional district, Social Security's trust fund
timeline, a personal tax receipt, and a balance-the-budget sandbox.

Every number comes from an official U.S. government source and every chart links to its dataset.

## The game

The site opens as a short civic game: **Help Uncle Sam balance the budget.** Uncle Sam is an
everyday American with a very big household who spends more than he brings in. The player is his
budget adviser.

- **Seven chapter levels** (Easy → Hard): his paycheck (revenue and your taxes), his bills
  (spending and the three buckets), back home (your state), spending more than he makes (the
  structural gap), the credit card (debt and interest), who writes his budget (Congress, CRs and
  the laws that moved deficits), and keeping his promises (Social Security).
- Each level is a step wizard of 4–6 short steps. A segmented progress bar shows the steps, and
  quick-check questions give explanatory feedback and reveal the answer after two tries. Each
  level ends with one vote on a real policy choice: a CBO-priced option, or a question such as
  the tax/cut mix or an automatic continuing resolution.
- **Budget desk missions** (Normal / Hard / Expert) unlock as chapters are finished. They use the
  policy-card planner with stars, badges and the economists' least-cost hint.
- **Rewards:** level certificates, adviser titles, a road map with time remaining, and a
  copyable "budget ballot" of the player's votes.
- **Reading settings:** text size, light/dark theme, read-aloud of Uncle Sam's lines (the
  browser's own speech), and free roam to unlock everything.
- **The fine print:** every level links to its full field-guide chapter and to the original
  government documents. The field guide (all earlier pages) is always in the sidebar.

Progress is saved in the browser only. On the claude.ai artifact, votes are also counted across
everyone who opens the page (one ballot per person).

**Live site:** https://richnguyen.github.io/follow-the-federal-dollar/

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # standalone site in dist/ (refreshes debt and latest month live from Treasury)
npm run build:artifact # one self-contained HTML page in dist-artifact/ (data baked in)
```

The standalone build is static and can be hosted anywhere (GitHub Pages, Netlify, Vercel, S3).
Routes are hash-based (`#spending`, `#state-ca`), so no server configuration is needed.

### Deployment

`.github/workflows/deploy-pages.yml` builds the site and publishes it to GitHub Pages on every
push to `main` (or on demand from the Actions tab). In the repository's **Settings → Pages**,
**Source** must be set to **GitHub Actions**. To update the data, run `npm run data` locally,
commit `src/data/generated/`, and push.

Voting on the Balance the Budget page needs a shared database, so it appears only on the
claude.ai version of the site; on GitHub Pages the game works without it. Badges and stars are
saved in each visitor's browser.

## Refresh the data

```bash
npm run data           # fetch every source (cached in data/raw/) and rebuild src/data/generated/
npm run data:build     # rebuild from the cache only
node scripts/fetch-all.mjs --refresh   # ignore the cache
```

`scripts/check-hosts.mjs` reports which source hosts are reachable. Behind an HTTP proxy, Node's
`fetch` needs `NODE_USE_ENV_PROXY=1` (the npm scripts set it).

| Data | Official source | How it's obtained |
|---|---|---|
| Receipts, outlays, deficit (monthly and by fiscal year), outlays by budget function and by agency/account, receipts by source, payroll taxes by trust fund, customs collections and refunds, trust fund balances | U.S. Treasury, Monthly Treasury Statement Tables 1, 4, 5, 8, 9 | Fiscal Data API (`scripts/fetch-treasury.mjs`) |
| Debt to the Penny, historical debt, interest expense, average interest rates | U.S. Treasury, Fiscal Data | Fiscal Data API |
| FY1962–FY2025 mandatory / discretionary / net interest, revenue history, debt held by the public, GDP; projections | OMB Historical Tables, FY2027 Budget (Tables 1.1, 2.1, 7.1, 8.1, 10.1) | XLSX from whitehouse.gov (`scripts/build-cbo.mjs`) |
| Federal awards by state and congressional district, top agencies and programs | USAspending.gov | USAspending API (`scripts/fetch-usaspending.mjs`) |
| Population, households | Census Bureau (Vintage 2025 estimate; Housing Vacancy Survey) | census.gov releases (`scripts/fetch-census.mjs`) |
| 2026 tax brackets, standard deduction, payroll tax parameters | IRS Rev. Proc. 2025-32, Publication 15, Topic 560 | irs.gov documents, recorded in `src/data/curated/tax.json` |
| Social Security and Medicare trust fund projections | 2026 Social Security and Medicare Trustees Reports | `src/data/curated/trustees.json` (cited) |
| Laws' deficit effects; budget-process history; who benefits | CBO/JCT cost estimates; CRS reports; agency statistics | `src/data/curated/*.json` (each entry cites its official URL) |

CBO's projections are the preferred benchmark for the gap chart and the sandbox. The pipeline uses
them automatically when `data/raw/cbo/baseline.parsed.json` exists; otherwise it uses OMB's
estimates and labels them as the President's budget.

## Code map

- `src/game/` the game layer: `levels.tsx` (level content; every figure and quiz answer is computed
  from the data), `LevelPage.tsx` (step wizard), `Journey.tsx` (hub), `state.tsx` (progress and
  reading settings), `UncleSam.tsx` (character and narration).
- `src/pages/` one file per field-guide section; `src/components/charts.tsx` the D3-based charts;
  `src/components/USMap.tsx` the state map; `src/lib/` formatting, categories, tax and sandbox math.
- `src/data/types.ts` is the contract between the pipeline and the app.
- Chart colors are a validated categorical palette (colorblind-safe order, both themes).
