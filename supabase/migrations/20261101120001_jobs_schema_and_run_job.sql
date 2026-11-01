-- Phase 2: abstract job execution layer + runJob pgflow flow hooks.

create schema jobs;

create table jobs.job_types (
  name text primary key,
  executor_kind text not null check (executor_kind in ('llm_sync', 'llm_batch')),
  input_schema jsonb not null default '{}'::jsonb,
  output_schema jsonb not null default '{}'::jsonb,
  retry_policy jsonb not null default '{"max_attempts": 3}'::jsonb,
  timeout_seconds integer not null default 180
);

create table jobs.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null,
  system_instruction text,
  template text,
  constraint prompt_templates_name_version_key unique (name, version)
);

create table jobs.jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null references jobs.job_types (name),
  correlation_id uuid,
  requested_by_event_id uuid,
  idempotency_key text not null,
  input jsonb not null default '{}'::jsonb,
  status text not null default 'requested'
    check (status in (
      'requested', 'running', 'waiting_external', 'succeeded', 'failed', 'cancelled'
    )),
  output jsonb,
  requested_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint jobs_job_type_idempotency_key unique (job_type, idempotency_key)
);

create index jobs_status_requested_at_idx on jobs.jobs (status, requested_at desc);
create index jobs_correlation_id_idx on jobs.jobs (correlation_id);

create table jobs.job_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs.jobs (id) on delete cascade,
  attempt_no integer not null,
  outcome text check (outcome in ('succeeded', 'retryable', 'terminal', 'rate_limited')),
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint job_attempts_job_attempt_no_key unique (job_id, attempt_no)
);

create table jobs.external_operations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references jobs.job_attempts (id) on delete cascade,
  provider text not null default 'gemini',
  operation_name text not null,
  state text not null,
  poll_count integer not null default 0,
  submitted_at timestamptz not null default now(),
  next_poll_at timestamptz not null default now(),
  completed_at timestamptz
);

create index external_operations_next_poll_at_idx
  on jobs.external_operations (next_poll_at)
  where completed_at is null;

create table jobs.llm_invocations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references jobs.job_attempts (id) on delete cascade,
  external_operation_id uuid references jobs.external_operations (id) on delete set null,
  item_index integer not null default 0,
  prompt_template_id uuid references jobs.prompt_templates (id),
  provider text not null default 'gemini',
  model text not null,
  params jsonb not null default '{}'::jsonb,
  request_blob_id uuid references podcast.blobs (id),
  response_blob_id uuid references podcast.blobs (id),
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  finish_reason text
);

create table jobs.pgflow_job_bindings (
  job_id uuid primary key references jobs.jobs (id) on delete cascade,
  flow_slug text not null default 'runJob',
  run_id uuid,
  step_slug text,
  created_at timestamptz not null default now()
);

insert into jobs.job_types (name, executor_kind, retry_policy, timeout_seconds) values
  ('write_script', 'llm_sync', '{"max_attempts": 3}'::jsonb, 180),
  ('render_audio', 'llm_batch', '{"max_attempts": 3}'::jsonb, 180),
  ('paint_artwork', 'llm_sync', '{"max_attempts": 3}'::jsonb, 180)
on conflict (name) do nothing;

-- Prompt template v1 from podcast_config when present (seed-config / legacy rows).
insert into jobs.prompt_templates (name, version, system_instruction, template)
select
  'generator.system',
  1,
  trim(both '"' from (value #>> '{}')),
  null
from podcast_config
where key = 'generator.system_instruction'
on conflict (name, version) do nothing;

insert into jobs.prompt_templates (name, version, system_instruction, template)
select
  'generator.user',
  1,
  null,
  trim(both '"' from (value #>> '{}'))
from podcast_config
where key = 'generator.prompt_template'
on conflict (name, version) do nothing;

insert into jobs.prompt_templates (name, version, system_instruction, template)
select
  'tts.instructions',
  1,
  trim(both '"' from (value #>> '{}')),
  null
from podcast_config
where key = 'tts.instructions'
on conflict (name, version) do nothing;

insert into jobs.prompt_templates (name, version, system_instruction, template)
select
  'image.prompt',
  1,
  null,
  trim(both '"' from (value #>> '{}'))
from podcast_config
where key = 'image.prompt_template'
on conflict (name, version) do nothing;

alter table jobs.job_types enable row level security;
alter table jobs.prompt_templates enable row level security;
alter table jobs.jobs enable row level security;
alter table jobs.job_attempts enable row level security;
alter table jobs.external_operations enable row level security;
alter table jobs.llm_invocations enable row level security;
alter table jobs.pgflow_job_bindings enable row level security;

create policy "service role all job_types" on jobs.job_types
  for all to service_role using (true) with check (true);
create policy "authenticated read job_types" on jobs.job_types
  for select to authenticated using (true);

create policy "service role all prompt_templates" on jobs.prompt_templates
  for all to service_role using (true) with check (true);
create policy "authenticated read prompt_templates" on jobs.prompt_templates
  for select to authenticated using (true);

create policy "service role all jobs" on jobs.jobs
  for all to service_role using (true) with check (true);
create policy "authenticated read jobs" on jobs.jobs
  for select to authenticated using (true);

create policy "service role all job_attempts" on jobs.job_attempts
  for all to service_role using (true) with check (true);
create policy "authenticated read job_attempts" on jobs.job_attempts
  for select to authenticated using (true);

create policy "service role all external_operations" on jobs.external_operations
  for all to service_role using (true) with check (true);
create policy "authenticated read external_operations" on jobs.external_operations
  for select to authenticated using (true);

create policy "service role all llm_invocations" on jobs.llm_invocations
  for all to service_role using (true) with check (true);
create policy "authenticated read llm_invocations" on jobs.llm_invocations
  for select to authenticated using (true);

create policy "service role all pgflow_job_bindings" on jobs.pgflow_job_bindings
  for all to service_role using (true) with check (true);
create policy "authenticated read pgflow_job_bindings" on jobs.pgflow_job_bindings
  for select to authenticated using (true);

grant usage on schema jobs to service_role, authenticated;
grant all on all tables in schema jobs to service_role;
grant select on all tables in schema jobs to authenticated;

-- Generic single-step pgflow flow for job execution.
select pgflow.create_flow('runJob', max_attempts => 1, base_delay => 5, timeout => 180);
select pgflow.add_step('runJob', 'execute', max_attempts => 1, timeout => 180);

insert into pgflow.worker_functions (function_name, enabled, updated_at)
values ('job-worker', true, now())
on conflict (function_name) do update
  set enabled = excluded.enabled,
      updated_at = excluded.updated_at;

create or replace function public.invoke_external_operation_poller()
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
    url := base_url || '/external-operation-poller',
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
    perform cron.unschedule('external_operation_poller');
  exception when others then
    null;
  end;

  perform cron.schedule(
    job_name => 'external_operation_poller',
    schedule => '* * * * *',
    command => 'select public.invoke_external_operation_poller();'
  );
end;
$$;
