-- Share stats: how sharing turns into new players. Three anonymous counts, by day, by the kind of
-- link (a plan challenge, the Budget Story, a room, ...), and by channel (X, WhatsApp, the phone's
-- share sheet, ...):
--   shares    the times someone pressed a share button or a social network link,
--   arrivals  the times a tagged link was opened (once per browser per day for each kind and channel),
--   players   new players whose first visit came through such a link (from their player record).
-- No identities are stored with the counts. Run after the earlier migrations. Safe to re-run.

create table if not exists public.share_counts (
  day date not null,
  kind text not null,
  channel text not null,
  shares integer not null default 0,
  arrivals integer not null default 0,
  primary key (day, kind, channel)
);
-- Row-level security with no policies: nobody reads or writes the table directly; only the
-- functions below do.
alter table public.share_counts enable row level security;

-- Where each player first came from, and when their record was created.
alter table public.players add column if not exists came_from text;
alter table public.players add column if not exists created_at timestamptz not null default now();
do $$ begin
  alter table public.players add constraint players_came_from_check
    check (came_from is null or came_from ~ '^(plan|story|clip|daily|peoples|room|chain|level|site)$');
exception when duplicate_object then null; end $$;

create or replace function public.share_kind_ok(k text) returns boolean
language sql immutable set search_path = '' as $$
  select k is not null and k ~ '^(plan|story|clip|daily|peoples|room|chain|level|site)$';
$$;
create or replace function public.share_channel_ok(c text) returns boolean
language sql immutable set search_path = '' as $$
  select c is not null and c ~ '^(x|fa|li|re|bl|th|wh|em|sh|cp)$';
$$;

-- One more share (anyone may call it; unknown kinds or channels are ignored).
create or replace function public.count_share(p_kind text, p_channel text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.share_kind_ok(p_kind) or not public.share_channel_ok(p_channel) then return; end if;
  insert into public.share_counts as s (day, kind, channel, shares)
  values ((now() at time zone 'utc')::date, p_kind, p_channel, 1)
  on conflict (day, kind, channel) do update set shares = s.shares + 1 where s.shares < 1000000;
end $$;

-- One more opened link.
create or replace function public.count_arrival(p_kind text, p_channel text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.share_kind_ok(p_kind) or not public.share_channel_ok(p_channel) then return; end if;
  insert into public.share_counts as s (day, kind, channel, arrivals)
  values ((now() at time zone 'utc')::date, p_kind, p_channel, 1)
  on conflict (day, kind, channel) do update set arrivals = s.arrivals + 1 where s.arrivals < 1000000;
end $$;

-- The stats for the last `window_days` days (UTC), as counts only.
create or replace function public.share_stats(window_days int default 30) returns jsonb
language sql stable security definer set search_path = '' as $$
  with d as (select least(greatest(coalesce(window_days, 30), 1), 3650) as n),
  since as (select (now() at time zone 'utc')::date - (select n from d) + 1 as day),
  sc as (select * from public.share_counts where day >= (select day from since)),
  np as (
    select coalesce(p.came_from, 'site') as kind, coalesce(p.channel, 'direct') as channel
    from public.players p
    where p.created_at >= ((select day from since)::timestamp at time zone 'utc')
  )
  select jsonb_build_object(
    'window_days', (select n from d),
    'since', (select day from since),
    'shares', coalesce((
      select jsonb_object_agg(kind, ch) from (
        select kind, jsonb_object_agg(channel, n) as ch from (
          select kind, channel, sum(shares) as n from sc group by kind, channel having sum(shares) > 0) x
        group by kind) y), '{}'::jsonb),
    'arrivals', coalesce((
      select jsonb_object_agg(kind, ch) from (
        select kind, jsonb_object_agg(channel, n) as ch from (
          select kind, channel, sum(arrivals) as n from sc group by kind, channel having sum(arrivals) > 0) x
        group by kind) y), '{}'::jsonb),
    'players', coalesce((
      select jsonb_object_agg(kind, ch) from (
        select kind, jsonb_object_agg(channel, n) as ch from (
          select kind, channel, count(*) as n from np group by kind, channel) x
        group by kind) y), '{}'::jsonb),
    'players_all', (select count(*) from public.players),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'shares', s, 'arrivals', a) order by day)
      from (select day, sum(shares) as s, sum(arrivals) as a from sc group by day) z), '[]'::jsonb)
  );
$$;

revoke all on function public.count_share(text, text) from public;
revoke all on function public.count_arrival(text, text) from public;
revoke all on function public.share_stats(int) from public;
grant execute on function public.count_share(text, text) to anon, authenticated;
grant execute on function public.count_arrival(text, text) to anon, authenticated;
grant execute on function public.share_stats(int) to anon, authenticated;
