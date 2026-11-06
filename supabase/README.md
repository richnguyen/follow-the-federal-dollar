# Supabase: shared data for balancethebudget.us

The public site is static (GitHub Pages), so shared features need a small backend: votes counted
across everyone, "how everyone played", short links for shared plans, and rankings of plans,
policy cards, and states (never of people). Supabase provides the database and anonymous sign-in.
The claude.ai copy of the game keeps using the artifact's own database.

**Status:** connected. Project `ygphfbeqgguypvmiundz`; the site's URL and publishable key are in
[`src/lib/backend.ts`](../src/lib/backend.ts). Only balancethebudget.us talks to the database: local
builds, previews, and forks stay offline unless `localStorage["ftd:backend"] = "on"` is set for
testing. Players sign in anonymously only when there is something to save (a vote or a finished
level), never just for visiting. CAPTCHA protection (Cloudflare Turnstile) is on: sign-ins without
a valid, unused token are refused (checked: no token, Cloudflare's test token, and a made-up token
are all refused, and a real browser sign-in succeeds).

## What is stored

| Table | One row per | Holds | Who can read it |
| --- | --- | --- | --- |
| `ballots` | player | support/oppose on cards, favorite ready-made plan, answers to the big questions | only that player |
| `players` | player | levels done, stars, first-try quiz results, medals, state (if picked), first-visit channel | only that player |
| `plans` | finished budget-desk plan | the plan part of the link, cards, stars | only its creator; others open one by its short-link id |
| `peoples_moves` | player per day | today's People's Budget move: one card, pushed in (+1) or out (-1) | only that player; only today's move can be changed or taken back |

Everyone can read totals through functions that return counts only: `ballot_totals()`,
`player_totals()`, `card_rankings(level)`, `state_rankings()` (states with 5+ players), and
`get_plan(id)`, `peoples_budget(window_days)` (each card's net pushes over the last 30 days) and
`peoples_recent(n)` (the latest moves, with no identity). Players sign in anonymously: no email,
no name, no password.

## Setup (about 10 minutes)

1. **Create the project.** At [supabase.com](https://supabase.com), sign in, then **New project**.
   Name it `help-uncle-sam`, set a database password (keep it in a password manager; nobody else
   needs it), pick the region **East US (North Virginia)**, and start on the **Free** plan.
2. **Allow anonymous sign-ins.** In the project: **Authentication → Sign In / Providers →
   Allow anonymous sign-ins**, then save.
3. **Create the tables.** Open **SQL Editor → New query**, paste each file in
   [`migrations/`](migrations/) in order, and **Run** each one:
   [`20261106000000_init.sql`](migrations/20261106000000_init.sql), then
   [`20261106010000_rankings.sql`](migrations/20261106010000_rankings.sql), then
   [`20261107000000_peoples_budget.sql`](migrations/20261107000000_peoples_budget.sql). Each is
   safe to run again.
4. **Copy two public values** from **Connect** (top of the dashboard) or **Settings → API Keys**:
   - the **Project URL**, like `https://abcdefghijklmnop.supabase.co`
   - the **publishable key**, starting `sb_publishable_`

   Both are meant to be public: they go in the website, and row-level security decides what
   each visitor can do. **Never share or commit the secret key (`sb_secret_…`) or the database
   password.**
5. **Turn on CAPTCHA (Cloudflare Turnstile).** Supabase recommends it with anonymous sign-ins,
   because otherwise a script could create accounts in bulk.
   1. The widget exists (site key `0x4AAAAAAF1rV7BXsS9-nG51`, domain `balancethebudget.us`); the
      game already sends a fresh token with every anonymous sign-in
      ([`src/lib/turnstile.ts`](../src/lib/turnstile.ts)).
   2. In the Cloudflare dashboard, open **Turnstile**, select the widget, and copy its
      **secret key**.
   3. In Supabase: **Authentication → Attack Protection → Enable CAPTCHA protection**, choose
      **Turnstile**, paste the secret key, and save. Supabase Auth then calls Cloudflare's
      siteverify on the server for each sign-in and refuses any without a valid, unused token.
      The secret lives only there: never in this repository, the site, or a chat.

   Supabase also limits anonymous sign-ins per IP address; the limit is under
   **Authentication → Rate Limits**. Copies of the game away from the real domain use
   Cloudflare's test site key, so they can't sign in once CAPTCHA is on; that is intended.

## Checking the schema locally

`npm run test:db` runs the migration in PGlite (Postgres compiled to WebAssembly) with stand-ins
for Supabase's auth schema, and checks the row-level security rules and every totals function.

## Costs and limits

The Free plan covers 500 MB of database, 50,000 monthly active users (each anonymous player counts),
and two projects; a Free project pauses after a week without activity. Pro is $25 a month when
the game outgrows that. Check [supabase.com/pricing](https://supabase.com/pricing) for current
numbers. Each player's rows are small (well under 10 KB), so 500 MB holds tens of thousands of
players. At larger scale, the totals functions should read from a summary table refreshed every
few minutes instead of counting every row on each call.

## Short links

A finished budget-desk plan is stored once (cards, across-the-board changes, phase-in, stars) and
gets a 12-character id, so shared links read `balancethebudget.us/?plan=58c5dc193efb&by=Sam`. The
sharer's first name and their answers to the big questions stay in the link (`by=`, `b=`) and are
never stored. Each player's latest plan on a level feeds "the cards players reach for". If the
database can't be reached, links fall back to the long form, which carries the whole plan and
works with no server.
