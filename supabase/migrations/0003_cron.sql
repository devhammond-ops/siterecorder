-- Scheduled invocation of the generate-report Edge Function.
--
-- The Edge Function itself decides which report_schedules are due (based on
-- frequency / day / send_hour / last_run_at), so this cron job simply pings it
-- once per hour. This keeps schedules fully admin-configurable from the UI
-- without ever editing cron.
--
-- PREREQUISITE (run once, values are project-specific — do NOT commit real keys):
--
--   select vault.create_secret('https://YOUR-REF.supabase.co', 'project_url');
--   select vault.create_secret('YOUR-SERVICE-ROLE-KEY', 'service_role_key');
--
-- These are read at runtime from Supabase Vault so secrets never live in
-- migration files or the cron job definition.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Remove any previous version of the job before (re)creating it.
select cron.unschedule('invoke-generate-report-hourly')
where exists (
  select 1 from cron.job where jobname = 'invoke-generate-report-hourly'
);

select cron.schedule(
  'invoke-generate-report-hourly',
  '5 * * * *', -- every hour at minute 5 (UTC)
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/generate-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := jsonb_build_object('trigger', 'cron'),
    timeout_milliseconds := 55000
  );
  $$
);
