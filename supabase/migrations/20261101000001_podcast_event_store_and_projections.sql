-- Phase 1: podcast event store, subscription metadata, and read projections (ToBe ER).

create schema podcast;

-- Append-only domain event log
create table podcast.domain_events (
  id uuid primary key default gen_random_uuid(),
  position bigserial not null,
  type text not null,
  stream_type text not null,
  stream_id uuid not null,
  stream_version bigint not null,
  occurred_at timestamptz not null,
  actor text not null,
  correlation_id uuid,
  causation_id uuid references podcast.domain_events (id),
  payload jsonb not null default '{}'::jsonb,
  constraint domain_events_position_key unique (position),
  constraint domain_events_stream_version_key unique (stream_id, stream_version)
);

create index domain_events_stream_idx
  on podcast.domain_events (stream_type, stream_id);

create index domain_events_occurred_at_idx
  on podcast.domain_events (occurred_at);

create or replace function podcast.reject_domain_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'podcast.domain_events is append-only';
end;
$$;

create trigger domain_events_no_update
  before update on podcast.domain_events
  for each row
  execute function podcast.reject_domain_event_mutation();

create trigger domain_events_no_delete
  before delete on podcast.domain_events
  for each row
  execute function podcast.reject_domain_event_mutation();

-- Subscription checkpoint (Phase 3+; created in Phase 1)
create table podcast.event_subscriptions (
  subscriber_id text primary key,
  last_processed_position bigint not null default 0,
  lease_owner text,
  leased_until timestamptz,
  updated_at timestamptz not null default now()
);

create table podcast.event_subscription_failures (
  id uuid primary key default gen_random_uuid(),
  subscriber_id text not null references podcast.event_subscriptions (subscriber_id),
  event_position bigint not null references podcast.domain_events (position),
  error_message text not null,
  failed_at timestamptz not null default now(),
  constraint event_subscription_failures_subscriber_position_key
    unique (subscriber_id, event_position)
);

-- Shared blobs (job layer + domain)
create table podcast.blobs (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null,
  sha256 text,
  produced_by_attempt_id uuid,
  created_at timestamptz not null default now()
);

create table podcast.shows (
  id uuid primary key,
  title text not null,
  description text not null,
  cover_blob_id uuid references podcast.blobs (id),
  publication_policy text not null
    check (publication_policy in ('auto', 'manual')),
  updated_at timestamptz not null default now()
);

create table podcast.articles (
  id uuid primary key,
  content_path text unique,
  mem_note_id text,
  created_at timestamptz not null
);

create table podcast.article_revisions (
  id uuid primary key,
  article_id uuid not null references podcast.articles (id) on delete cascade,
  content_sha text not null,
  title text not null,
  content text not null,
  registered_at timestamptz not null
);

create index article_revisions_article_id_idx
  on podcast.article_revisions (article_id, registered_at desc);

create table podcast.episodes (
  id uuid primary key,
  show_id uuid not null references podcast.shows (id),
  article_id uuid not null references podcast.articles (id),
  guid text not null unique,
  created_at timestamptz not null,
  constraint episodes_one_per_article_key unique (article_id)
);

create table podcast.productions (
  id uuid primary key,
  episode_id uuid not null references podcast.episodes (id) on delete cascade,
  article_revision_id uuid not null references podcast.article_revisions (id),
  base_revision_id uuid,
  scope text not null check (scope in ('full', 'audio', 'artwork')),
  trigger text not null check (trigger in ('ingest', 'manual', 'migration')),
  profile jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null
);

create index productions_episode_id_idx on podcast.productions (episode_id);

create table podcast.scripts (
  id uuid primary key,
  article_revision_id uuid not null references podcast.article_revisions (id),
  production_id uuid not null references podcast.productions (id) on delete cascade,
  produced_by_job_id uuid,
  title text not null,
  description text not null,
  content text not null,
  created_at timestamptz not null
);

create table podcast.audios (
  id uuid primary key,
  script_id uuid not null references podcast.scripts (id),
  production_id uuid not null references podcast.productions (id) on delete cascade,
  produced_by_job_id uuid,
  blob_id uuid not null references podcast.blobs (id),
  duration_ms integer not null default 0,
  casting jsonb not null default '{}'::jsonb,
  created_at timestamptz not null
);

create table podcast.artworks (
  id uuid primary key,
  script_id uuid not null references podcast.scripts (id),
  production_id uuid not null references podcast.productions (id) on delete cascade,
  produced_by_job_id uuid,
  blob_id uuid not null references podcast.blobs (id),
  created_at timestamptz not null
);

create table podcast.episode_revisions (
  id uuid primary key,
  episode_id uuid not null references podcast.episodes (id) on delete cascade,
  production_id uuid not null references podcast.productions (id),
  script_id uuid not null references podcast.scripts (id),
  audio_id uuid not null references podcast.audios (id),
  artwork_id uuid references podcast.artworks (id),
  title text not null,
  description text not null,
  assembled_at timestamptz not null
);

create index episode_revisions_episode_id_idx
  on podcast.episode_revisions (episode_id, assembled_at desc);

-- productions.base_revision_id references episode_revisions (added after episode_revisions exists)
alter table podcast.productions
  add constraint productions_base_revision_id_fkey
  foreign key (base_revision_id) references podcast.episode_revisions (id);

create table podcast.episode_publications (
  id uuid primary key,
  episode_revision_id uuid not null references podcast.episode_revisions (id) on delete cascade,
  published_at timestamptz not null,
  withdrawn_at timestamptz
);

create index episode_publications_revision_idx
  on podcast.episode_publications (episode_revision_id, published_at desc);

create table podcast.feed_snapshots (
  id uuid primary key,
  show_id uuid not null references podcast.shows (id),
  blob_id uuid not null references podcast.blobs (id),
  item_count integer not null default 0,
  built_at timestamptz not null
);

create table podcast.feed_items (
  feed_snapshot_id uuid not null references podcast.feed_snapshots (id) on delete cascade,
  position integer not null,
  episode_revision_id uuid not null references podcast.episode_revisions (id),
  guid text not null,
  pub_date timestamptz not null,
  primary key (feed_snapshot_id, position)
);

-- RLS (service_role bypasses; authenticated read for monitoring / future UI)
alter table podcast.domain_events enable row level security;
alter table podcast.event_subscriptions enable row level security;
alter table podcast.event_subscription_failures enable row level security;
alter table podcast.blobs enable row level security;
alter table podcast.shows enable row level security;
alter table podcast.articles enable row level security;
alter table podcast.article_revisions enable row level security;
alter table podcast.episodes enable row level security;
alter table podcast.productions enable row level security;
alter table podcast.scripts enable row level security;
alter table podcast.audios enable row level security;
alter table podcast.artworks enable row level security;
alter table podcast.episode_revisions enable row level security;
alter table podcast.episode_publications enable row level security;
alter table podcast.feed_snapshots enable row level security;
alter table podcast.feed_items enable row level security;

create policy "service role insert domain_events"
  on podcast.domain_events for insert to service_role with check (true);

create policy "authenticated read domain_events"
  on podcast.domain_events for select to authenticated using (true);

create policy "service role all event_subscriptions"
  on podcast.event_subscriptions for all to service_role using (true) with check (true);

create policy "authenticated read event_subscriptions"
  on podcast.event_subscriptions for select to authenticated using (true);

create policy "service role all event_subscription_failures"
  on podcast.event_subscription_failures for all to service_role using (true) with check (true);

create policy "authenticated read event_subscription_failures"
  on podcast.event_subscription_failures for select to authenticated using (true);

create policy "service role all blobs"
  on podcast.blobs for all to service_role using (true) with check (true);

create policy "authenticated read blobs"
  on podcast.blobs for select to authenticated using (true);

create policy "service role all shows"
  on podcast.shows for all to service_role using (true) with check (true);

create policy "authenticated read shows"
  on podcast.shows for select to authenticated using (true);

create policy "service role all articles"
  on podcast.articles for all to service_role using (true) with check (true);

create policy "authenticated read articles"
  on podcast.articles for select to authenticated using (true);

create policy "service role all article_revisions"
  on podcast.article_revisions for all to service_role using (true) with check (true);

create policy "authenticated read article_revisions"
  on podcast.article_revisions for select to authenticated using (true);

create policy "service role all episodes"
  on podcast.episodes for all to service_role using (true) with check (true);

create policy "authenticated read episodes"
  on podcast.episodes for select to authenticated using (true);

create policy "service role all productions"
  on podcast.productions for all to service_role using (true) with check (true);

create policy "authenticated read productions"
  on podcast.productions for select to authenticated using (true);

create policy "service role all scripts"
  on podcast.scripts for all to service_role using (true) with check (true);

create policy "authenticated read scripts"
  on podcast.scripts for select to authenticated using (true);

create policy "service role all audios"
  on podcast.audios for all to service_role using (true) with check (true);

create policy "authenticated read audios"
  on podcast.audios for select to authenticated using (true);

create policy "service role all artworks"
  on podcast.artworks for all to service_role using (true) with check (true);

create policy "authenticated read artworks"
  on podcast.artworks for select to authenticated using (true);

create policy "service role all episode_revisions"
  on podcast.episode_revisions for all to service_role using (true) with check (true);

create policy "authenticated read episode_revisions"
  on podcast.episode_revisions for select to authenticated using (true);

create policy "service role all episode_publications"
  on podcast.episode_publications for all to service_role using (true) with check (true);

create policy "authenticated read episode_publications"
  on podcast.episode_publications for select to authenticated using (true);

create policy "service role all feed_snapshots"
  on podcast.feed_snapshots for all to service_role using (true) with check (true);

create policy "authenticated read feed_snapshots"
  on podcast.feed_snapshots for select to authenticated using (true);

create policy "service role all feed_items"
  on podcast.feed_items for all to service_role using (true) with check (true);

create policy "authenticated read feed_items"
  on podcast.feed_items for select to authenticated using (true);

grant usage on schema podcast to service_role, authenticated;
grant all on all tables in schema podcast to service_role;
grant select on all tables in schema podcast to authenticated;
grant usage, select on all sequences in schema podcast to service_role;
