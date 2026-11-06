-- Help Uncle Sam Balance the Budget: shared data for the public site (balancethebudget.us).
--
-- Every player signs in anonymously (no email, no name). Each player can read and write only
-- their own rows; everyone can read totals, through the functions at the bottom, which return
-- counts and never individual rows. Rankings cover plans, policy cards, and states, never people.
--
-- Run once in the Supabase SQL Editor (or with `supabase db push`). Safe to re-run.

-- ---------------------------------------------------------------------------------------------
-- Ballots: one per player, the same shape the game already uses:
--   { "options": { "<card id>": 1 | -1 }, "plan": "<ready-made plan id>" | null,
--     "issues": { "<question id>": "<answer>" }, "updated": "<ISO time>" }
-- ---------------------------------------------------------------------------------------------
create table if not exists public.ballots (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  ballot jsonb not null,
  updated_at timestamptz not null default now(),
  constraint ballot_shape check (
    jsonb_typeof(ballot) = 'object'
    and jsonb_typeof(coalesce(ballot -> 'options', '{}'::jsonb)) = 'object'
    and jsonb_typeof(coalesce(ballot -> 'issues', '{}'::jsonb)) = 'object'
    and pg_column_size(ballot) <= 4096
  )
);

-- ---------------------------------------------------------------------------------------------
-- Players: one anonymous progress record each (levels done, stars, first-try quiz results,
-- medals), plus their state if they picked one on level 3 and the channel their first visit came
-- from (?s=x on a shared link). No names, no answers to votes.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.players (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  record jsonb not null,
  state text check (state ~ '^[A-Z]{2}$'),
  channel text check (channel ~ '^[a-z0-9-]{1,16}$'),
  updated_at timestamptz not null default now(),
  constraint record_shape check (
    jsonb_typeof(record) = 'object'
    and jsonb_typeof(coalesce(record -> 'done', '[]'::jsonb)) = 'array'
    and jsonb_typeof(coalesce(record -> 'stars', '{}'::jsonb)) = 'object'
    and jsonb_typeof(coalesce(record -> 'firstTry', '{}'::jsonb)) = 'object'
    and jsonb_typeof(coalesce(record -> 'medals', '[]'::jsonb)) = 'array'
    and pg_column_size(record) <= 8192
  )
);

-- ---------------------------------------------------------------------------------------------
-- Shared plans: short links (balancethebudget.us/?plan=<id>) and the data behind the plan and
-- card rankings. `code` is the plan part of a long link (p=10.acg&lv=r5.d-5&ph=0). The sharer's
-- answers to the big questions stay in the link only; they are not stored here.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.plans (
  id text primary key default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  level smallint not null check (level in (5, 8, 10)),
  code text not null check (code ~ '^[a-z0-9.=&-]{1,160}$'),
  cards text[] not null default '{}' check (cardinality(cards) <= 40),
  stars smallint not null check (stars between 0 and 3),
  revenue_share real check (revenue_share between 0 and 1),
  by_name text check (char_length(by_name) <= 24),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists plans_level_idx on public.plans (level);
create index if not exists plans_created_by_idx on public.plans (created_by, created_at);

-- ---------------------------------------------------------------------------------------------
-- Row-level security: your own rows only.
-- ---------------------------------------------------------------------------------------------
alter table public.ballots enable row level security;
alter table public.players enable row level security;
alter table public.plans enable row level security;

drop policy if exists "own ballot: read" on public.ballots;
drop policy if exists "own ballot: add" on public.ballots;
drop policy if exists "own ballot: change" on public.ballots;
drop policy if exists "own ballot: remove" on public.ballots;
create policy "own ballot: read" on public.ballots for select to authenticated using (user_id = (select auth.uid()));
create policy "own ballot: add" on public.ballots for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own ballot: change" on public.ballots for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own ballot: remove" on public.ballots for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own record: read" on public.players;
drop policy if exists "own record: add" on public.players;
drop policy if exists "own record: change" on public.players;
drop policy if exists "own record: remove" on public.players;
create policy "own record: read" on public.players for select to authenticated using (user_id = (select auth.uid()));
create policy "own record: add" on public.players for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own record: change" on public.players for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own record: remove" on public.players for delete to authenticated using (user_id = (select auth.uid()));

-- Plans: anyone signed in may add one; nobody can list them. A plan is read by its id through
-- get_plan(), so only people who were sent the link can open it.
drop policy if exists "own plans: add" on public.plans;
drop policy if exists "own plans: read" on public.plans;
drop policy if exists "own plans: remove" on public.plans;
create policy "own plans: add" on public.plans for insert to authenticated with check (created_by = (select auth.uid()));
create policy "own plans: read" on public.plans for select to authenticated using (created_by = (select auth.uid()));
create policy "own plans: remove" on public.plans for delete to authenticated using (created_by = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Housekeeping: updated_at on every change, and a daily cap on shared plans per player.
-- ---------------------------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists ballots_touch on public.ballots;
create trigger ballots_touch before update on public.ballots for each row execute function public.touch_updated_at();
drop trigger if exists players_touch on public.players;
create trigger players_touch before update on public.players for each row execute function public.touch_updated_at();

create or replace function public.plans_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.plans p where p.created_by = new.created_by and p.created_at > now() - interval '1 day') >= 30 then
    raise exception 'Too many shared plans today; try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists plans_quota on public.plans;
create trigger plans_quota before insert on public.plans for each row execute function public.plans_quota();

-- ---------------------------------------------------------------------------------------------
-- Public totals. These run with the owner's rights so they can count everyone's rows, and they
-- return only counts. Groups smaller than 5 people are left out of the state ranking.
-- ---------------------------------------------------------------------------------------------
create or replace function public.ballot_totals() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'voters', (select count(*) from public.ballots),
    'options', coalesce((
      select jsonb_object_agg(id, jsonb_build_object('support', support, 'oppose', oppose))
      from (
        select e.key as id,
               count(*) filter (where e.value = '1'::jsonb) as support,
               count(*) filter (where e.value = '-1'::jsonb) as oppose
        from public.ballots b, jsonb_each(coalesce(b.ballot -> 'options', '{}'::jsonb)) e
        group by e.key
      ) o), '{}'::jsonb),
    'plans', coalesce((
      select jsonb_object_agg(plan, n)
      from (
        select b.ballot ->> 'plan' as plan, count(*) as n
        from public.ballots b
        where jsonb_typeof(b.ballot -> 'plan') = 'string'
        group by 1
      ) p), '{}'::jsonb),
    'issues', coalesce((
      select jsonb_object_agg(id, counts)
      from (
        select id, jsonb_object_agg(choice, n) as counts
        from (
          select e.key as id, e.value as choice, count(*) as n
          from public.ballots b, jsonb_each_text(coalesce(b.ballot -> 'issues', '{}'::jsonb)) e
          where e.value is not null and e.value <> ''
          group by e.key, e.value
        ) x
        group by id
      ) i), '{}'::jsonb)
  );
$$;

create or replace function public.player_totals() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'players', (select count(*) from public.players),
    'done', coalesce((
      select jsonb_object_agg(lvl, n) from (
        select d as lvl, count(*) as n
        from public.players p, jsonb_array_elements_text(coalesce(p.record -> 'done', '[]'::jsonb)) d
        group by d) x), '{}'::jsonb),
    'stars', coalesce((
      select jsonb_object_agg(lvl, jsonb_build_object('sum', s, 'n', n)) from (
        select e.key as lvl, sum(e.value::int) as s, count(*) as n
        from public.players p, jsonb_each_text(coalesce(p.record -> 'stars', '{}'::jsonb)) e
        where e.value ~ '^[0-3]$'
        group by e.key) x), '{}'::jsonb),
    'firstTry', coalesce((
      select jsonb_object_agg(q, jsonb_build_object('right', r, 'n', n)) from (
        select e.key as q, count(*) filter (where e.value = 'true') as r, count(*) as n
        from public.players p, jsonb_each_text(coalesce(p.record -> 'firstTry', '{}'::jsonb)) e
        group by e.key) x), '{}'::jsonb),
    'medals', coalesce((
      select jsonb_object_agg(m, n) from (
        select m, count(*) as n
        from public.players p, jsonb_array_elements_text(coalesce(p.record -> 'medals', '[]'::jsonb)) m
        group by m) x), '{}'::jsonb),
    'channels', coalesce((
      select jsonb_object_agg(channel, n) from (
        select channel, count(*) as n from public.players where channel is not null group by channel) x), '{}'::jsonb)
  );
$$;

-- One shared plan, by the id in its short link.
create or replace function public.get_plan(plan_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'level', p.level, 'code', p.code, 'stars', p.stars, 'by', p.by_name, 'created_at', p.created_at)
  from public.plans p where p.id = plan_id;
$$;

-- Which policy cards players use most on a level: the share of shared plans that include each.
create or replace function public.card_rankings(lvl smallint default 10)
returns table (card text, plans bigint, share numeric)
language sql stable security definer set search_path = '' as $$
  with t as (select count(*)::numeric as total from public.plans where level = lvl)
  select c as card, count(*) as plans, round(count(*) / nullif((select total from t), 0), 4) as share
  from public.plans, unnest(cards) as c
  where level = lvl
  group by c
  order by plans desc, card;
$$;

-- States as teams: how far their players have got, on average. Only states with 5+ players.
create or replace function public.state_rankings()
returns table (state text, players bigint, avg_levels numeric, avg_stars numeric)
language sql stable security definer set search_path = '' as $$
  select p.state,
         count(*) as players,
         round(avg(jsonb_array_length(coalesce(p.record -> 'done', '[]'::jsonb))), 2) as avg_levels,
         round(avg((select coalesce(sum(e.value::int), 0) from jsonb_each_text(coalesce(p.record -> 'stars', '{}'::jsonb)) e where e.value ~ '^[0-3]$')), 2) as avg_stars
  from public.players p
  where p.state is not null
  group by p.state
  having count(*) >= 5
  order by avg_levels desc, players desc;
$$;

revoke all on function public.ballot_totals() from public;
revoke all on function public.player_totals() from public;
revoke all on function public.get_plan(text) from public;
revoke all on function public.card_rankings(smallint) from public;
revoke all on function public.state_rankings() from public;
grant execute on function public.ballot_totals() to anon, authenticated;
grant execute on function public.player_totals() to anon, authenticated;
grant execute on function public.get_plan(text) to anon, authenticated;
grant execute on function public.card_rankings(smallint) to anon, authenticated;
grant execute on function public.state_rankings() to anon, authenticated;
