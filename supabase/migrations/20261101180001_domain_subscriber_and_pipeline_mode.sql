-- Phase 3: domain event wake queue, subscriber cron, pipeline.mode default.

do $$
begin
  perform pgmq.create('domain_events_wake');
exception when others then
  null;
end $$;

insert into podcast.event_subscriptions (subscriber_id, last_processed_position)
values ('production-policy', 0)
on conflict (subscriber_id) do nothing;

create or replace function podcast.notify_domain_events_wake()
returns trigger
language plpgsql
security definer
set search_path = podcast, pgmq, public, pg_temp
as $$
begin
  perform pgmq.send(
    'domain_events_wake',
    jsonb_build_object('position', NEW.position)
  );
  return NEW;
end;
$$;

create trigger domain_events_after_insert_wake
  after insert on podcast.domain_events
  for each row
  execute function podcast.notify_domain_events_wake();

create or replace function public.invoke_domain_subscriber()
returns bigint
language plpgsql
set search_path = public, pg_temp
as $$
declare
  is_local boolean := coalesce(
    current_setting('app.settings.jwt_secret', true) =
      'super-secret-jwt-token-with-at-least-32-characters-long',
    false
  );
  base_url text;
  service_key text;
  request_id bigint;
  lagging boolean;
begin
  select exists (
    select 1
    from podcast.domain_events e
    join podcast.event_subscriptions s on s.subscriber_id = 'production-policy'
    where e.position > s.last_processed_position
  ) into lagging;

  if not lagging then
    return null;
  end if;

  if is_local then
    base_url := 'http://kong:8000/functions/v1';
  else
    select 'https://' || decrypted_secret || '.supabase.co/functions/v1'
      into base_url
      from vault.decrypted_secrets
      where name = 'supabase_project_id'
      limit 1;

    select decrypted_secret
      into service_key
      from vault.decrypted_secrets
      where name = 'pgflow_auth_secret'
      limit 1;
  end if;

  if base_url is null then
    return null;
  end if;

  request_id := net.http_post(
    url := base_url || '/domain-subscriber',
    headers := case
      when is_local then '{"Content-Type":"application/json"}'::jsonb
      else jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      )
    end,
    body := '{}'::jsonb
  );

  return request_id;
end;
$$;

insert into pgflow.worker_functions (function_name, enabled, updated_at)
values ('domain-subscriber', true, now())
on conflict (function_name) do update
  set enabled = excluded.enabled,
      updated_at = excluded.updated_at;

do $$
begin
  begin
    perform cron.unschedule('domain_subscriber_backup');
  exception when others then
    null;
  end;

  perform cron.schedule(
    job_name => 'domain_subscriber_backup',
    schedule => '* * * * *',
    command => 'select public.invoke_domain_subscriber();'
  );
end;
$$;

insert into podcast_config (key, value)
values ('pipeline.mode', '"legacy"'::jsonb)
on conflict (key) do nothing;
