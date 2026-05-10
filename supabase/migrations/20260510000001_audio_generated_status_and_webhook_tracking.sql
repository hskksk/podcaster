alter table episodes
  drop constraint if exists episodes_status_check;

alter table episodes
  add constraint episodes_status_check
  check (
    status in (
      'ingested',
      'script_running',
      'script_ready',
      'script_failed',
      'audio_running',
      'audio_generated',
      'audio_downloading',
      'audio_ready',
      'audio_failed',
      'published',
      'rss_failed'
    )
  );

alter table audio_files
  add column if not exists batch_name text,
  add column if not exists callback_received_at timestamptz,
  add column if not exists callback_payload jsonb;

update audio_files
set batch_name = coalesce(
  batch_name,
  nullif(llm_response #>> '{batch,jobName}', ''),
  nullif(llm_response #>> '{batch,job_name}', '')
)
where status = 'pending'
  and batch_name is null;

create unique index if not exists audio_files_batch_name_unique_idx
  on audio_files (batch_name)
  where batch_name is not null;

create index if not exists episodes_status_created_at_idx
  on episodes (status, created_at desc);

create index if not exists audio_files_created_at_idx
  on audio_files (created_at desc);

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.invoke_download_monitor()
returns bigint
language plpgsql
set search_path = public, pg_temp
as $$
declare
  is_local boolean := coalesce(
    current_setting('app.settings.jwt_secret', true) = 'super-secret-jwt-token-with-at-least-32-characters-long',
    false
  );
  base_url text;
  service_key text;
  request_id bigint;
begin
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
    url := base_url || '/download-monitor',
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

do $$
begin
  begin
    perform cron.unschedule('download_monitor_audio_generated');
  exception when others then
    null;
  end;

  perform cron.schedule(
    job_name => 'download_monitor_audio_generated',
    schedule => '* * * * *',
    command => 'select public.invoke_download_monitor();'
  );
end;
$$;
