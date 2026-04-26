create table processing_logs (
  id            uuid primary key default gen_random_uuid(),
  queue_name    text        not null,
  message_id    bigint,
  episode_id    uuid        references episodes(id) on delete set null,
  article_id    uuid        references articles(id) on delete set null,
  status        text        not null check (status in ('success', 'failure')),
  error_message text,
  duration_ms   integer,
  processed_at  timestamptz not null default now()
);

create index processing_logs_queue_name_idx   on processing_logs (queue_name);
create index processing_logs_episode_id_idx   on processing_logs (episode_id);
create index processing_logs_article_id_idx   on processing_logs (article_id);
create index processing_logs_processed_at_idx on processing_logs (processed_at desc);

alter table processing_logs enable row level security;

create policy "service role insert" on processing_logs
  for insert to service_role with check (true);

create policy "authenticated read" on processing_logs
  for select to authenticated using (true);
