# Help Uncle Sam Balance the Budget

A plain-language web app that shows average voters where U.S. federal tax money goes: spending by
purpose and by every agency account, revenue by source, the structural gap between autopilot
spending and revenue, the debt and interest, the laws that changed deficits, how Congress actually
budgets, federal money in each state and congressional district, Social Security's trust fund
timeline, a personal tax receipt, and a balance-the-budget sandbox.

Every number comes from an official U.S. government source and every chart links to its dataset.

**Play it:** https://balancethebudget.us/
(repository: [richnguyen/help-uncle-sam-balance-the-budget](https://github.com/richnguyen/help-uncle-sam-balance-the-budget);
the old address, richnguyen.github.io/help-uncle-sam-balance-the-budget, forwards there)

## The game

The site opens as a civic game: **Help Uncle Sam balance the budget.** Uncle Sam is an everyday
American with a very big household who spends more than he brings in. The player is his
budget adviser.

- **Ten levels on one road map.** Chapters explain one part of the budget each: his paycheck,
  his bills, back home, the structural gap, the credit card (debt), who writes the budget
  (Congress and the laws that moved deficits), and keeping his promises (Social Security).
  Three **budget-desk levels** (5, 8 and 10) are the hard "wall" levels, where the player fixes
  the budget with CBO-priced options. Each keeps a thin scoreboard pinned at the top while the
  player scrolls through policy cards and ready-made plans, each linked to the closest real
  proposal in Congress. Difficulty runs in a rhythm: easy, easy, easy, medium,
  hard, then a breather, and so on up to a final super-hard level.
- **Steps, checks and votes.** Each chapter is 4–6 short steps with a segmented progress bar.
  Quick checks give explanatory feedback and reveal the answer after two tries. Each chapter
  ends with one vote on a real policy choice. Level 7 explains each major law: what it did and
  why its official estimate came out so large.
- **Uncle Sam talks and reacts.** His lines are pre-recorded with Kokoro, an open-weight
  neural voice model, so he sounds natural and the same on every device; his pace follows his
  mood. Visitors can switch to one of their device's voices in settings. His face,
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
- **One top bar, no side panel.** Left: "Your journey" (the road map). Middle: the current level
  and the ten-level track; hovering it lists every level to jump to, plus the field-guide
  chapters. Then stars and accomplishments (medals and budget-desk badges). Right: Continue,
  Uncle Sam's voice switch, Glossary, Methods (sources & methods) and Settings.
- **Settings** (top bar): text size, light/dark theme, voice choice, vibration, and free roam to
  unlock everything.
- **The fine print:** each level's full field-guide chapter and original government documents
  are gathered on Sources & methods ("By level"), one link from every level. The field guide
  (all earlier pages) is listed in the top bar's level menu and in every page's footer.

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

### Sharing and coming back

Built from the Mambo.io list of 108 gamification elements, keeping the white-hat ones (meaning,
accomplishment, creativity, friendly rivalry) and leaving out the pressure tactics (timers,
expiring rewards, streaks that punish a missed day, public ranking of people).

- **Challenge a friend** (`?p=…`): a finished budget-desk plan travels inside the link itself,
  with an optional first name and, if the player chooses, their answers to the big questions.
  The friend sees the plan (`#plan`), plays the same level straight away, and gets a
  head-to-head (stars, steepest year for the economy, cards used) and an agreement count
  ("you agree on 7 of 12 choices").
- **Your Budget Story** (`#story`): six phone-story cards (1080×1920) drawn as SVG and saved as
  PNG: a nonpartisan budget personality, the biggest move, the player's own tax receipt under the
  plan, the debt path against current law, and the closest real proposal.
- **A 10-second clip** of the plan bending the debt curve, with Uncle Sam's recorded voice, made
  in the browser with a canvas and MediaRecorder (MP4 where supported, else WebM).
- **The Daily Dollar** (`#daily`, `?daily`): five higher-or-lower calls a day on real federal
  numbers, the same puzzle for everyone on a date, with a spoiler-free result grid to post.
- **Uncle Sam reacts** the first time each policy card is played, with one true fact from CBO's
  data, and the desk shows what the plan means for the player's own tax receipt.
- Shared links carry a channel tag (`?s=x`, `wh`, `sh`…), saved with the player's anonymous
  record so first visits can be counted by channel.
- Short links (`?plan=<id>`) for finished plans, and rankings of policy cards and states (never of
  people) on "How everyone played".

Progress is saved in the browser. The game also keeps one anonymous record per player (levels
finished, stars, first-try answers, medals) and one ballot per person, and "How everyone played"
(`#results`, offered at the end of level 10) totals them: on balancethebudget.us in the site's
Supabase database ([`supabase/`](supabase/README.md): row-level security, count-only totals),
and on the claude.ai artifact in the artifact's shared database. Any other copy (a local build, a
fork) stays offline and shows only the player's own results.

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
**Source** must be set to **GitHub Actions**, and **Custom domain** is `balancethebudget.us`
(DNS: A/AAAA records for the apex pointing at GitHub Pages, and `www` as a CNAME to
`richnguyen.github.io`). With an Actions deployment the domain lives in that setting, not in a
CNAME file. To update the data, run `npm run data` locally, commit `src/data/generated/`, and push.

Shared voting totals and "How everyone played" need a shared database, so they work on the
claude.ai copy of the site; on the public site the game shows each player's own results. Badges,
stars and progress are saved in each visitor's browser.

## Re-record Uncle Sam's voice

Uncle Sam's lines are recorded ahead of time with [Kokoro](https://github.com/hexgrad/kokoro)
(Apache 2.0) via [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx), voice `am_michael`.
After changing any of his lines:

```sh
python3 -m venv .venv && .venv/bin/pip install kokoro-onnx soundfile   # once; also needs ffmpeg
mkdir -p .kokoro && cd .kokoro && curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx \
  -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin && cd ..
npm run dev &                      # the collector reads the lines from the running app (needs Playwright)
npm run voice:collect              # writes scripts/voice/lines.json
PATH=.venv/bin:$PATH npm run voice:synth   # writes public/voice/*.mp3 and src/data/generated/voice.json
```

Lines without a recording fall back to the browser's own speech, so nothing breaks in between.

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
