-- Remove cron jobs installed by 20260423000003 (they used current_setting which
-- requires ALTER DATABASE SET — not permitted for postgres role on Supabase Cloud).
-- deploy.ts will recreate these with hardcoded URLs and vault-based auth.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'drain-script-queue') then
    perform cron.unschedule('drain-script-queue');
  end if;
  if exists (select 1 from cron.job where jobname = 'drain-audio-queue') then
    perform cron.unschedule('drain-audio-queue');
  end if;
  if exists (select 1 from cron.job where jobname = 'drain-rss-queue') then
    perform cron.unschedule('drain-rss-queue');
  end if;
end;
$$;
