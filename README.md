# Follow the Federal Dollar

A plain-language web app that shows average voters where U.S. federal tax money goes: spending by
purpose and by every agency account, revenue by source, the structural gap between autopilot
spending and revenue, the debt and interest, the laws that changed deficits, how Congress actually
budgets, federal money in each state and congressional district, Social Security's trust fund
timeline, a personal tax receipt, and a balance-the-budget sandbox.

Every number comes from an official U.S. government source and every chart links to its dataset.

## The game

The site opens as a civic game: **Help Uncle Sam balance the budget.** Uncle Sam is an everyday
American with a very big household who spends more than he brings in. The player is his
budget adviser.

- **Ten levels on one road map.** Chapters explain one part of the budget each: his paycheck,
  his bills, back home, the structural gap, the credit card (debt), who writes the budget
  (Congress and the laws that moved deficits), and keeping his promises (Social Security).
  Three **budget-desk levels** (5, 8 and 10) are the hard "wall" levels, where the player fixes
  the budget with CBO-priced options. Difficulty runs in a rhythm: easy, easy, easy, medium,
  hard, then a breather, and so on up to a final super-hard level.
- **Steps, checks and votes.** Each chapter is 4–6 short steps with a segmented progress bar.
  Quick checks give explanatory feedback and reveal the answer after two tries. Each chapter
  ends with one vote on a real policy choice. Level 7 explains each major law: what it did and
  why its official estimate came out so large.
- **Uncle Sam talks and reacts.** He reads his lines aloud with the browser's own speech,
  preferring a male U.S. English voice and changing pace and pitch with his mood. His face,
  hat and arms change with his mood, and he nods and talks while speaking. At the budget desk
  he coaches in real time as the plan changes. Speech is on by default and can be switched off
  from the top bar or in settings.
- **Rewards.**
  - Up to three stars per level (all questions right on the first try, or the budget-desk
    star rules).
  - A celebration card on finishing a level, with the certificate earned, a quote from American
    history on citizenship, responsibility, the future or the economy, and a preview of the next
    level.
  - Adviser titles and a copyable "budget ballot".
- **Always-visible status.** The top bar shows the current level, the ten-level track, total
  stars, the player's title, a Continue button and the voice switch.
- **Reading settings:** text size, light/dark theme, voice choice, and free roam to unlock
  everything.
- **The fine print:** every level links to its full field-guide chapter and to the original
  government documents. The field guide (all earlier pages) is always in the sidebar.

### Design notes: five UX lessons from Royal Match, without the pressure tactics

1. **Keep colors simple.** Game chrome uses four bold, high-contrast fills by difficulty (green
   easy, blue medium, red hard, purple super hard), always paired with a distinct icon
   silhouette per level, so levels read by shape as well as color. Charts keep their validated
   data palette.
2. **Don't slow down.** Nothing waits for an animation or for Uncle Sam to finish speaking.
   Keyboard play: 1–4 or A–D to answer, Enter or → to continue, ← to go back. The celebration
   card closes with one tap or Escape, and Continue in the top bar jumps straight back in.
3. **Feedback you can feel.** On phones that support vibration: a tick for a right answer, a
   soft double tap for a miss, a short flourish for a finished level or a medal (switchable in
   settings). For everyone else, buttons and answers respond to the press.
4. **Be generous with rewards.** Stars, certificates, adviser titles, fact cards from every
   chapter, and medals that reward taking part (voting, reading the original documents,
   exploring the field guide, sharing) as much as winning. The budget-desk hint is free and
   unlimited, and every level can be finished. The article's other tactic, levels tuned to be
   "almost winnable" to sell boosters, is deliberately left out: there are no timers, lives,
   streak penalties, leaderboards, ads or purchases.
5. **Make it easy to share.** Share buttons on the celebration card, fact cards, ballot and
   certificate use the phone's share sheet, falling back to the clipboard. On the public site,
   "Save image" makes a 1200×630 card with the level, stars, a fact and Uncle Sam.

Progress is saved in the browser only. On the claude.ai artifact, votes are also counted across
everyone who opens the page (one ballot per person).

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
  from the data), `LevelPage.tsx` (step wizard), `Journey.tsx` (road map), `Celebrate.tsx`
  (level-complete card), `StatusBar.tsx`, `LawExplorer.tsx`, `quotes.ts`, `state.tsx` (progress
  and settings), `voice.tsx` (speech: voice choice, mood prosody), `UncleSam.tsx` (character).
- `src/pages/` one file per field-guide section; `src/components/charts.tsx` the D3-based charts;
  `src/components/USMap.tsx` the state map; `src/lib/` formatting, categories, tax and sandbox math.
- `src/data/types.ts` is the contract between the pipeline and the app.
- Chart colors are a validated categorical palette (colorblind-safe order, both themes).
