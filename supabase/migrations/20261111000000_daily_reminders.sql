-- Daily Dollar reminders: an opt-in notification, at most once a day, at the hour each player
-- picks in their own time zone. Sent with Web Push by the daily-reminders Edge Function
-- (supabase/functions/daily-reminders), which Supabase Cron runs every hour.
--
-- A device's push subscription is an address at the browser maker's push service (Google, Apple,
-- Mozilla) plus two keys that let only that device read the message. It holds no name or email.
-- Players can see and remove their own; everything else goes through the functions below.
-- Run after the earlier migrations. Safe to re-run.

create table if not exists public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://' and length(endpoint) < 1024),
  player uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{16,32}$'),
  hour smallint not null check (hour between 0 and 23),
  tz text not null check (length(tz) between 1 and 64),
  created_at timestamptz not null default now(),
  last_sent_on date,          -- the player's local date of the last reminder (one a day at most)
  welcomed boolean not null default false
);
create index if not exists push_subscriptions_player on public.push_subscriptions (player);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own subscriptions: read" on public.push_subscriptions;
create policy "own subscriptions: read" on public.push_subscriptions for select using (player = auth.uid());
drop policy if exists "own subscriptions: delete" on public.push_subscriptions;
create policy "own subscriptions: delete" on public.push_subscriptions for delete using (player = auth.uid());

-- Reminders sent per day (UTC), for the share stats page. No identities.
create table if not exists public.reminder_counts (
  day date primary key,
  sent integer not null default 0
);
alter table public.reminder_counts enable row level security;

-- Turn reminders on (or change the hour) for this device. One row per device: saving the same
-- address again, even from a new anonymous player on that device, replaces the old row.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_hour int, p_tz text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then p_tz := 'America/New_York'; end if;
  if (select count(*) from public.push_subscriptions where player = auth.uid() and endpoint <> p_endpoint) >= 5 then
    raise exception 'reminders are on for 5 devices already';
  end if;
  insert into public.push_subscriptions as s (endpoint, player, p256dh, auth, hour, tz)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, p_hour, p_tz)
  on conflict (endpoint) do update set player = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, hour = excluded.hour, tz = excluded.tz;
end $$;

-- Turn reminders off for this device. The address itself is the proof: only that browser knows it.
create or replace function public.remove_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;

-- For the sender only (service role): the devices whose chosen hour has come today and that
-- haven't had today's reminder. Up to two hours late, in case an hourly run was missed.
create or replace function public.due_reminders(p_limit int default 2000)
returns table (endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = '' as $$
  select s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  where extract(hour from now() at time zone s.tz) between s.hour and least(s.hour + 2, 23)
    and (s.last_sent_on is null or s.last_sent_on < (now() at time zone s.tz)::date)
  order by s.created_at
  limit greatest(1, least(p_limit, 5000));
$$;

-- For the sender only: these devices got today's reminder.
create or replace function public.mark_reminders_sent(p_endpoints text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.push_subscriptions s set last_sent_on = (now() at time zone s.tz)::date where s.endpoint = any (p_endpoints);
  if coalesce(array_length(p_endpoints, 1), 0) > 0 then
    insert into public.reminder_counts as c (day, sent) values ((now() at time zone 'utc')::date, array_length(p_endpoints, 1))
    on conflict (day) do update set sent = c.sent + excluded.sent;
  end if;
end $$;

-- For the sender only: devices the push service says are gone (the player uninstalled, cleared
-- the site's data, or blocked notifications).
create or replace function public.drop_push_subscriptions(p_endpoints text[])
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = any (p_endpoints);
$$;

-- For the sender only: the "reminders are on" notification, once, right after a device opts in.
create or replace function public.claim_welcome(p_endpoint text)
returns table (endpoint text, p256dh text, auth text, hour smallint)
language sql security definer set search_path = '' as $$
  update public.push_subscriptions s set welcomed = true
  where s.endpoint = p_endpoint and not s.welcomed and s.created_at > now() - interval '10 minutes'
  returning s.endpoint, s.p256dh, s.auth, s.hour;
$$;

-- For the share stats page (anyone): how many devices have reminders on, and how many were sent.
create or replace function public.reminder_stats(window_days int default 30)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'devices', (select count(*) from public.push_subscriptions),
    'sent', coalesce((select sum(sent) from public.reminder_counts where day > (now() at time zone 'utc')::date - greatest(1, least(window_days, 3650))), 0)
  );
$$;

revoke all on function public.save_push_subscription(text, text, text, int, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, int, text) to authenticated;
revoke all on function public.remove_push_subscription(text) from public;
grant execute on function public.remove_push_subscription(text) to anon, authenticated;
revoke all on function public.due_reminders(int) from public, anon, authenticated;
revoke all on function public.mark_reminders_sent(text[]) from public, anon, authenticated;
revoke all on function public.drop_push_subscriptions(text[]) from public, anon, authenticated;
revoke all on function public.claim_welcome(text) from public, anon, authenticated;
grant execute on function public.due_reminders(int), public.mark_reminders_sent(text[]), public.drop_push_subscriptions(text[]), public.claim_welcome(text) to service_role;
grant execute on function public.reminder_stats(int) to anon, authenticated;

-- Opening the game from a reminder counts as its own channel ("pu") in the share stats.
create or replace function public.share_channel_ok(c text) returns boolean
language sql immutable set search_path = '' as $$
  select c is not null and c ~ '^(x|fa|li|re|bl|th|wh|em|sh|cp|pu)$';
$$;
