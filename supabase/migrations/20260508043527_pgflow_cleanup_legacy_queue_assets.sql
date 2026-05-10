-- Clean up legacy queue-based pipeline assets after pgflow migration.

-- 1) Remove old queue-drain cron jobs if they still exist.
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
exception
  when undefined_table then
    -- pg_cron is not installed in this environment.
    null;
end;
$$;

-- 2) Remove legacy queue RPC wrappers used by the old queue workers.
drop function if exists pgmq_read(text, int, int);
drop function if exists pgmq_send(text, jsonb);
drop function if exists pgmq_delete(text, bigint);

-- 3) Drop old per-stage queues if they are still present.
do $$
begin
  if exists (select 1 from pgmq.list_queues() where queue_name = 'script-queue') then
    perform pgmq.drop_queue('script-queue');
  end if;
  if exists (select 1 from pgmq.list_queues() where queue_name = 'audio-queue') then
    perform pgmq.drop_queue('audio-queue');
  end if;
  if exists (select 1 from pgmq.list_queues() where queue_name = 'rss-queue') then
    perform pgmq.drop_queue('rss-queue');
  end if;
end;
$$;
