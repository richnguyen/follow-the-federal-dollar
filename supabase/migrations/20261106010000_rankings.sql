-- Rankings count each player once, and the totals report who finished the whole game.
-- Run after 20261106000000_init.sql. Safe to re-run.

-- Which policy cards players use on a level: each player's latest plan on that level counts once.
create or replace function public.card_rankings(lvl smallint default 10)
returns table (card text, plans bigint, share numeric)
language sql stable security definer set search_path = '' as $$
  with latest as (
    select distinct on (p.created_by) p.cards
    from public.plans p
    where p.level = lvl
    order by p.created_by, p.created_at desc
  ),
  t as (select count(*)::numeric as total from latest)
  select c as card, count(*) as plans, round(count(*) / nullif((select total from t), 0), 4) as share
  from latest, unnest(latest.cards) as c
  group by c
  order by plans desc, card;
$$;

-- Everyone's totals, now with players who finished all ten levels and the stars they earned in all.
create or replace function public.player_totals() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'players', (select count(*) from public.players),
    'finished_all', (
      select count(*) from public.players p
      where coalesce(p.record -> 'done', '[]'::jsonb) @> '["level-1","level-2","level-3","level-4","level-5","level-6","level-7","level-8","level-9","level-10"]'::jsonb),
    'stars_total', (
      select coalesce(sum(e.value::int), 0)
      from public.players p, jsonb_each_text(coalesce(p.record -> 'stars', '{}'::jsonb)) e
      where e.value ~ '^[0-3]$'),
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

revoke all on function public.card_rankings(smallint) from public;
revoke all on function public.player_totals() from public;
grant execute on function public.card_rankings(smallint) to anon, authenticated;
grant execute on function public.player_totals() to anon, authenticated;
