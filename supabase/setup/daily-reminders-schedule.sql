-- Schedules the Daily Dollar reminders: every hour at five past, Supabase Cron asks the
-- daily-reminders Edge Function to send the reminders that are due (each device at the hour its
-- player picked, in their own time zone, at most once a day).
--
-- Run this ONCE in the SQL Editor, after the function is deployed and its secrets are saved
-- (steps in supabase/README.md). Before you run it, replace PASTE-THE-SAME-CRON-SECRET below with
-- the CRON_SECRET value you saved for the function. The value goes into Supabase Vault
-- (encrypted); don't commit it to this file.
--
-- To stop the reminders later:   select cron.unschedule('daily-dollar-reminders');
-- To change the schedule: unschedule first, then run the cron.schedule part again.

-- 1. The scheduler and the database's HTTP client (nothing happens if they're already on).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 2. The cron secret, kept in Vault.
select vault.create_secret('PASTE-THE-SAME-CRON-SECRET', 'daily_reminders_cron_secret', 'Sent by Supabase Cron to the daily-reminders Edge Function');

-- 3. Every hour at :05, call the function with the secret.
select cron.schedule(
  'daily-dollar-reminders',
  '5 * * * *',
  $job$
  select net.http_post(
    url := 'https://ygphfbeqgguypvmiundz.supabase.co/functions/v1/daily-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'daily_reminders_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $job$
);
