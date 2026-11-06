# Supabase: shared data for balancethebudget.us

The public site is static (GitHub Pages), so shared features need a small backend: votes counted
across everyone, "how everyone played", short links for shared plans, and rankings of plans,
policy cards, and states (never of people). Supabase provides the database and anonymous sign-in.
The claude.ai copy of the game keeps using the artifact's own database.

## What is stored

| Table | One row per | Holds | Who can read it |
| --- | --- | --- | --- |
| `ballots` | player | support/oppose on cards, favorite ready-made plan, answers to the big questions | only that player |
| `players` | player | levels done, stars, first-try quiz results, medals, state (if picked), first-visit channel | only that player |
| `plans` | shared plan | the plan part of the link, cards, stars, optional first name | only its creator; others open one by its link id |

Everyone can read totals through functions that return counts only: `ballot_totals()`,
`player_totals()`, `card_rankings(level)`, `state_rankings()` (states with 5+ players), and
`get_plan(id)`. Players sign in anonymously: no email, no name, no password.

## Setup (about 10 minutes)

1. **Create the project.** At [supabase.com](https://supabase.com), sign in, then **New project**.
   Name it `help-uncle-sam`, set a database password (keep it in a password manager; nobody else
   needs it), pick the region **East US (North Virginia)**, and start on the **Free** plan.
2. **Allow anonymous sign-ins.** In the project: **Authentication → Sign In / Providers →
   Allow anonymous sign-ins**, then save.
3. **Create the tables.** Open **SQL Editor → New query**, paste all of
   [`migrations/20261106000000_init.sql`](migrations/20261106000000_init.sql), and **Run**. It is
   safe to run again.
4. **Copy two public values** from **Connect** (top of the dashboard) or **Settings → API Keys**:
   - the **Project URL**, like `https://abcdefghijklmnop.supabase.co`
   - the **publishable key**, starting `sb_publishable_`

   Both are meant to be public: they go in the website, and row-level security decides what
   each visitor can do. **Never share or commit the secret key (`sb_secret_…`) or the database
   password.**
5. **Before a big launch: turn on CAPTCHA.** Supabase recommends it with anonymous sign-ins,
   because otherwise a script could create accounts in bulk.
   1. In a free Cloudflare account, go to **Turnstile → Add widget**, add the domain
      `balancethebudget.us`, and choose the **Invisible** or **Managed** mode.
   2. In Supabase: **Authentication → Attack Protection → Enable CAPTCHA protection**, choose
      **Turnstile**, and paste the Turnstile **secret key**.
   3. Send the Turnstile **site key** (public) so the game can pass a token when it signs in.

   Supabase also limits anonymous sign-ins per IP address; the limit is under
   **Authentication → Rate Limits**.

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
