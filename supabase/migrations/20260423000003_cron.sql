-- Enable pg_cron and pg_net for scheduling Edge Function calls
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Cron jobs poll each queue every minute.
-- The function URL and service key are set as database settings during deployment.
-- For local dev: manually call the endpoints via `pnpm post-test` or `supabase functions serve`.

select cron.schedule(
  'drain-script-queue',
  '* * * * *',
  $$
    select net.http_post(
      url     := current_setting('app.functions_url', true) || '/generate-script',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_key', true)
      ),
      body    := '{}'::jsonb
    )
    where current_setting('app.functions_url', true) is not null
      and current_setting('app.functions_url', true) != '';
  $$
);

select cron.schedule(
  'drain-audio-queue',
  '* * * * *',
  $$
    select net.http_post(
      url     := current_setting('app.functions_url', true) || '/generate-audio',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_key', true)
      ),
      body    := '{}'::jsonb
    )
    where current_setting('app.functions_url', true) is not null
      and current_setting('app.functions_url', true) != '';
  $$
);

select cron.schedule(
  'drain-rss-queue',
  '* * * * *',
  $$
    select net.http_post(
      url     := current_setting('app.functions_url', true) || '/update-rss',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_key', true)
      ),
      body    := '{}'::jsonb
    )
    where current_setting('app.functions_url', true) is not null
      and current_setting('app.functions_url', true) != '';
  $$
);
