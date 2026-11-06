-- The People's Budget: one shared budget built by everyone. Each player gets one move a day: push
-- one policy card in (+1) or out (-1). A card is in the People's Budget when, over the last 30
-- days, more moves pushed it in than out. Moves are anonymous; totals come from count-only
-- functions. Run after the earlier migrations. Safe to re-run.

create table if not exists public.peoples_moves (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The day is the server's (UTC), never the visitor's clock.
  day date not null default ((now() at time zone 'utc')::date),
  card text not null check (card ~ '^[a-z0-9-]{1,60}$'),
  dir smallint not null check (dir in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists peoples_moves_day_idx on public.peoples_moves (day);
create index if not exists peoples_moves_updated_idx on public.peoples_moves (updated_at desc);

alter table public.peoples_moves enable row level security;

-- A player sees their own moves, and can make, change, or take back only today's.
drop policy if exists "own moves: read" on public.peoples_moves;
drop policy if exists "today's move: add" on public.peoples_moves;
drop policy if exists "today's move: change" on public.peoples_moves;
drop policy if exists "today's move: take back" on public.peoples_moves;
create policy "own moves: read" on public.peoples_moves for select to authenticated
  using (user_id = (select auth.uid()));
create policy "today's move: add" on public.peoples_moves for insert to authenticated
  with check (user_id = (select auth.uid()) and day = (now() at time zone 'utc')::date);
create policy "today's move: change" on public.peoples_moves for update to authenticated
  using (user_id = (select auth.uid()) and day = (now() at time zone 'utc')::date)
  with check (user_id = (select auth.uid()) and day = (now() at time zone 'utc')::date);
create policy "today's move: take back" on public.peoples_moves for delete to authenticated
  using (user_id = (select auth.uid()) and day = (now() at time zone 'utc')::date);

drop trigger if exists peoples_moves_touch on public.peoples_moves;
create trigger peoples_moves_touch before update on public.peoples_moves for each row execute function public.touch_updated_at();

-- The People's Budget now: each card's net pushes over the window, and how many took part.
create or replace function public.peoples_budget(window_days int default 30) returns jsonb
language sql stable security definer set search_path = '' as $$
  with d as (select least(greatest(coalesce(window_days, 30), 1), 365) as n),
  w as (
    select m.* from public.peoples_moves m, d
    where m.day > (now() at time zone 'utc')::date - d.n
  )
  select jsonb_build_object(
    'window_days', (select n from d),
    'contributors', (select count(distinct user_id) from w),
    'moves', (select count(*) from w),
    'today', (select count(*) from public.peoples_moves where day = (now() at time zone 'utc')::date),
    'all_time', (select count(*) from public.peoples_moves),
    'cards', coalesce((
      select jsonb_object_agg(card, jsonb_build_object('net', net, 'in', ins, 'out', outs))
      from (
        select card, sum(dir) as net, count(*) filter (where dir = 1) as ins, count(*) filter (where dir = -1) as outs
        from w group by card
      ) c), '{}'::jsonb)
  );
$$;

-- The latest moves, with no one's identity: which card, which way, and when.
create or replace function public.peoples_recent(n int default 12)
returns table (card text, dir smallint, at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.card, m.dir, m.updated_at as at
  from public.peoples_moves m
  order by m.updated_at desc
  limit least(greatest(coalesce(n, 12), 1), 50);
$$;

revoke all on function public.peoples_budget(int) from public;
revoke all on function public.peoples_recent(int) from public;
grant execute on function public.peoples_budget(int) to anon, authenticated;
grant execute on function public.peoples_recent(int) to anon, authenticated;
