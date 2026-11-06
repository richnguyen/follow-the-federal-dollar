-- Rooms: a class, an office, or a family plays together. Someone starts a room (a name and one
-- budget-desk level) and shares its 6-character code; everyone who joins plays that level, and
-- each member's latest plan joins the room's plan. The room sees totals for its members only,
-- never who did what; vote breakdowns appear once 3 people have joined. Run after the earlier
-- migrations. Safe to re-run.

-- Codes avoid look-alike characters (no I, L, O, 0, 1).
create or replace function public.room_code() returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6);
$$;

create table if not exists public.rooms (
  code text primary key default public.room_code() check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$'),
  name text not null check (char_length(name) between 1 and 40 and name !~ '[[:cntrl:]]'),
  level smallint not null check (level in (5, 8, 10)),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists rooms_created_by_idx on public.rooms (created_by, created_at);

create table if not exists public.room_members (
  room text not null references public.rooms (code) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  -- The member's latest plan for the room's level (cards only; null until they finish it).
  cards text[] check (cards is null or cardinality(cards) <= 40),
  stars smallint check (stars between 0 and 3),
  plan_at timestamptz,
  primary key (room, user_id)
);
create index if not exists room_members_user_idx on public.room_members (user_id);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

-- Rooms: anyone signed in may start one; only its starter can see the row directly, rename, or
-- close it. Everyone else reads a room by its code through get_room().
drop policy if exists "own rooms: add" on public.rooms;
drop policy if exists "own rooms: read" on public.rooms;
drop policy if exists "own rooms: rename" on public.rooms;
drop policy if exists "own rooms: close" on public.rooms;
create policy "own rooms: add" on public.rooms for insert to authenticated with check (created_by = (select auth.uid()));
create policy "own rooms: read" on public.rooms for select to authenticated using (created_by = (select auth.uid()));
create policy "own rooms: rename" on public.rooms for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "own rooms: close" on public.rooms for delete to authenticated using (created_by = (select auth.uid()));

-- Memberships: your own only.
drop policy if exists "own membership: read" on public.room_members;
drop policy if exists "own membership: join" on public.room_members;
drop policy if exists "own membership: update plan" on public.room_members;
drop policy if exists "own membership: leave" on public.room_members;
create policy "own membership: read" on public.room_members for select to authenticated using (user_id = (select auth.uid()));
create policy "own membership: join" on public.room_members for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own membership: update plan" on public.room_members for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own membership: leave" on public.room_members for delete to authenticated using (user_id = (select auth.uid()));

-- Limits: 10 new rooms per person a day, 500 members per room, 20 rooms per person.
create or replace function public.rooms_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.rooms r where r.created_by = new.created_by and r.created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too many new rooms today; try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists rooms_quota on public.rooms;
create trigger rooms_quota before insert on public.rooms for each row execute function public.rooms_quota();

create or replace function public.room_members_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.room_members m where m.room = new.room) >= 500 then
    raise exception 'This room is full.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.room_members m where m.user_id = new.user_id) >= 20 then
    raise exception 'You are in too many rooms; leave one first.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists room_members_quota on public.room_members;
create trigger room_members_quota before insert on public.room_members for each row execute function public.room_members_quota();

-- A room by its code: name, level, how many joined and sent a plan, and whether you started it.
create or replace function public.get_room(room_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'code', r.code, 'name', r.name, 'level', r.level, 'created_at', r.created_at,
    'members', (select count(*) from public.room_members m where m.room = r.code),
    'plans', (select count(*) from public.room_members m where m.room = r.code and m.cards is not null),
    'mine', coalesce(r.created_by = auth.uid(), false)
  )
  from public.rooms r where r.code = upper(room_code);
$$;

-- Everything the room sees, as counts: cards in members' plans, stars, levels finished, and (once
-- 3 have joined) how members voted on the game's questions and policy cards.
create or replace function public.room_totals(room_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with r as (select code from public.rooms where code = upper(room_code)),
  m as (select mm.* from public.room_members mm join r on r.code = mm.room),
  p as (select * from m where cards is not null),
  pl as (select pl.record from public.players pl join m on m.user_id = pl.user_id),
  b as (select bl.ballot from public.ballots bl join m on m.user_id = bl.user_id)
  select case when not exists (select 1 from r) then null else jsonb_build_object(
    'members', (select count(*) from m),
    'plans', (select count(*) from p),
    'cards', coalesce((select jsonb_object_agg(c, k) from (select c, count(*) as k from p, unnest(p.cards) as c group by c) x), '{}'::jsonb),
    'stars', coalesce((select jsonb_object_agg(s, k) from (select stars::text as s, count(*) as k from p where stars is not null group by stars) x), '{}'::jsonb),
    'done', coalesce((select jsonb_object_agg(lvl, k) from (select d as lvl, count(*) as k from pl, jsonb_array_elements_text(coalesce(pl.record -> 'done', '[]'::jsonb)) d group by d) x), '{}'::jsonb),
    'votes', case when (select count(*) from m) >= 3 then jsonb_build_object(
      'voters', (select count(*) from b),
      'options', coalesce((
        select jsonb_object_agg(id, jsonb_build_object('support', s, 'oppose', o)) from (
          select e.key as id, count(*) filter (where e.value = '1'::jsonb) as s, count(*) filter (where e.value = '-1'::jsonb) as o
          from b, jsonb_each(coalesce(b.ballot -> 'options', '{}'::jsonb)) e group by e.key) x), '{}'::jsonb),
      'issues', coalesce((
        select jsonb_object_agg(id, counts) from (
          select id, jsonb_object_agg(choice, k) as counts from (
            select e.key as id, e.value as choice, count(*) as k
            from b, jsonb_each_text(coalesce(b.ballot -> 'issues', '{}'::jsonb)) e
            where e.value is not null and e.value <> ''
            group by e.key, e.value) y group by id) x), '{}'::jsonb)
    ) else null end
  ) end;
$$;

revoke all on function public.get_room(text) from public;
revoke all on function public.room_totals(text) from public;
grant execute on function public.get_room(text) to anon, authenticated;
grant execute on function public.room_totals(text) to anon, authenticated;
