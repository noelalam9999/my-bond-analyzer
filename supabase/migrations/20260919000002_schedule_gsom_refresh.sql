-- Daily GSOM refresh: pg_cron → pg_net → refresh-gsom edge function.
-- The function URL and anon key are read from Vault so they don't sit in the job definition.
-- Before applying on a new project, create the two secrets (values are project-specific):
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/refresh-gsom', 'refresh_gsom_url');
--   select vault.create_secret('<anon key>', 'supabase_anon_key');

-- 11:00 UTC = 17:00 Dhaka, after the BD trading day, so each day's GSOM figures are captured once settled.
select cron.schedule(
  'refresh-gsom-daily',
  '0 11 * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'refresh_gsom_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key')
    ),
    body    := '{"source":"cron"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
