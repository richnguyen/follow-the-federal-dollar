-- The challenge funnel: of the people who open a friend's plan link, how many take the challenge,
-- meet the goal, and send a plan back. Anonymous daily counts, each step once per challenge per
-- browser. Run after the earlier migrations. Safe to re-run.

create table if not exists public.challenge_steps (
  day date not null,
  step text not null check (step in ('taken', 'met', 'returned')),
  n integer not null default 0,
  primary key (day, step)
);
-- Row-level security with no policies: only the functions below touch it.
alter table public.challenge_steps enable row level security;

create or replace function public.count_challenge_step(p_step text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_step is null or p_step not in ('taken', 'met', 'returned') then return; end if;
  insert into public.challenge_steps as c (day, step, n)
  values ((now() at time zone 'utc')::date, p_step, 1)
  on conflict (day, step) do update set n = c.n + 1 where c.n < 1000000;
end $$;

-- The share stats, now with the funnel.
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
    'funnel', (
      select jsonb_build_object(
        'taken', coalesce(sum(n) filter (where step = 'taken'), 0),
        'met', coalesce(sum(n) filter (where step = 'met'), 0),
        'returned', coalesce(sum(n) filter (where step = 'returned'), 0))
      from public.challenge_steps where day >= (select day from since)),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'shares', s, 'arrivals', a) order by day)
      from (select day, sum(shares) as s, sum(arrivals) as a from sc group by day) z), '[]'::jsonb)
  );
$$;

revoke all on function public.count_challenge_step(text) from public;
grant execute on function public.count_challenge_step(text) to anon, authenticated;
grant execute on function public.share_stats(int) to anon, authenticated;
