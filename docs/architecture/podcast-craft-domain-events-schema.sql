-- Podcast craft — ドメインイベント DDL（to-be）
-- 方針: 汎用 craft_domain_events は使わず、イベント種別ごとに専用テーブル（1 イベント = 1 エンティティ）
-- 設計: docs/architecture/podcast-craft-edit-sessions.md
-- 説明: docs/architecture/podcast-craft-domain-events.md
--
-- 適用前に /security-review。新規 migration として切り出すこと。

-- ---------------------------------------------------------------------------
-- 共通列（各 *\_events 表に繰り返す）
--   id uuid PK
--   occurred_at timestamptz
--   actor text  system | operator | ingest | workflow
--   correlation_id uuid null
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 編集セッション
-- ---------------------------------------------------------------------------
create table episode_edits (
  id                      uuid primary key default gen_random_uuid(),
  episode_id              uuid not null references episodes(id) on delete cascade,
  kind                    text not null check (kind in ('episode', 'script', 'audio', 'artwork')),
  status                  text not null default 'started'
    check (status in ('started', 'ended', 'failed', 'cancelled')),
  trigger                 text not null default 'manual'
    check (trigger in ('ingest', 'manual', 'queued', 'monitor')),
  input_script_draft_id   uuid null,
  workflow_run_id         uuid null,
  start_event_kind        text null,
  start_event_id          uuid null,
  end_event_kind          text null,
  end_event_id            uuid null,
  started_at              timestamptz not null default now(),
  ended_at                timestamptz null,
  failure_message         text null
);

create index episode_edits_episode_id_started_at_idx
  on episode_edits (episode_id, started_at desc);

alter table episode_edits enable row level security;

-- ---------------------------------------------------------------------------
-- Ingest / Identity
-- ---------------------------------------------------------------------------
create table article_registered_events (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  actor            text not null default 'ingest',
  correlation_id   uuid null,
  article_id       uuid not null references articles(id) on delete restrict,
  content_path     text null,
  content_sha      text null,
  ingest_route     text null
);

create table episode_created_events (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  actor            text not null default 'system',
  correlation_id   uuid null,
  episode_id       uuid not null references episodes(id) on delete restrict,
  article_id       uuid not null references articles(id) on delete restrict
);

-- ---------------------------------------------------------------------------
-- Edit 開始（種別ごとに別エンティティ）
-- ---------------------------------------------------------------------------
create table episode_edit_started_events (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  actor            text not null default 'workflow',
  correlation_id   uuid null,
  edit_id          uuid not null references episode_edits(id) on delete restrict,
  episode_id       uuid not null references episodes(id) on delete restrict,
  workflow_run_id  uuid null
);

create table script_edit_started_events (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  actor            text not null default 'operator',
  correlation_id   uuid null,
  edit_id          uuid not null references episode_edits(id) on delete restrict,
  episode_id       uuid not null references episodes(id) on delete restrict
);

create table audio_edit_started_events (
  id                      uuid primary key default gen_random_uuid(),
  occurred_at             timestamptz not null default now(),
  actor                   text not null default 'operator',
  correlation_id          uuid null,
  edit_id                 uuid not null references episode_edits(id) on delete restrict,
  episode_id              uuid not null references episodes(id) on delete restrict,
  input_script_draft_id   uuid not null
);

create table artwork_edit_started_events (
  id                      uuid primary key default gen_random_uuid(),
  occurred_at             timestamptz not null default now(),
  actor                   text not null default 'operator',
  correlation_id          uuid null,
  edit_id                 uuid not null references episode_edits(id) on delete restrict,
  episode_id              uuid not null references episodes(id) on delete restrict,
  input_script_draft_id   uuid not null
);

-- ---------------------------------------------------------------------------
-- Edit 中 — 台本
-- ---------------------------------------------------------------------------
create table script_created_events (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  actor            text not null default 'system',
  correlation_id   uuid null,
  edit_id          uuid not null references episode_edits(id) on delete restrict,
  episode_id       uuid not null references episodes(id) on delete restrict,
  script_draft_id  uuid not null,
  title            text not null,
  description      text not null
);

create table script_generation_failed_events (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  actor            text not null default 'system',
  correlation_id   uuid null,
  edit_id          uuid not null references episode_edits(id) on delete restrict,
  episode_id       uuid not null references episodes(id) on delete restrict,
  error            text not null,
  script_draft_id  uuid null
);

-- ---------------------------------------------------------------------------
-- Edit 中 — 音声
-- ---------------------------------------------------------------------------
create table tts_submitted_events (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  actor            text not null default 'system',
  correlation_id   uuid null,
  edit_id          uuid not null references episode_edits(id) on delete restrict,
  episode_id       uuid not null references episodes(id) on delete restrict,
  tts_job_id       uuid not null,
  script_draft_id  uuid not null,
  batch_name       text not null
);

create table tts_job_succeeded_events (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  actor            text not null default 'system',
  correlation_id   uuid null,
  edit_id          uuid not null references episode_edits(id) on delete restrict,
  episode_id       uuid not null references episodes(id) on delete restrict,
  tts_job_id       uuid not null,
  batch_name       text not null
);

create table tts_job_failed_events (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  actor            text not null default 'system',
  correlation_id   uuid null,
  edit_id          uuid not null references episode_edits(id) on delete restrict,
  episode_id       uuid not null references episodes(id) on delete restrict,
  tts_job_id       uuid not null,
  error            text not null
);

create table episode_audio_created_events (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  actor            text not null default 'system',
  correlation_id   uuid null,
  edit_id          uuid not null references episode_edits(id) on delete restrict,
  episode_id       uuid not null references episodes(id) on delete restrict,
  episode_audio_id uuid not null,
  tts_job_id       uuid not null,
  storage_path     text not null,
  mime_type        text not null
);

create table episode_audio_storage_failed_events (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  actor            text not null default 'system',
  correlation_id   uuid null,
  edit_id          uuid not null references episode_edits(id) on delete restrict,
  episode_id       uuid not null references episodes(id) on delete restrict,
  tts_job_id       uuid not null,
  error            text not null
);

-- ---------------------------------------------------------------------------
-- Edit 中 — アートワーク
-- ---------------------------------------------------------------------------
create table artwork_created_events (
  id                 uuid primary key default gen_random_uuid(),
  occurred_at        timestamptz not null default now(),
  actor              text not null default 'system',
  correlation_id     uuid null,
  edit_id            uuid not null references episode_edits(id) on delete restrict,
  episode_id         uuid not null references episodes(id) on delete restrict,
  episode_artwork_id uuid not null,
  script_draft_id    uuid not null,
  storage_path       text not null,
  mime_type          text not null
);

create table artwork_skipped_events (
  id                      uuid primary key default gen_random_uuid(),
  occurred_at             timestamptz not null default now(),
  actor                   text not null default 'system',
  correlation_id          uuid null,
  edit_id                 uuid not null references episode_edits(id) on delete restrict,
  episode_id              uuid not null references episodes(id) on delete restrict,
  script_draft_id         uuid not null,
  placeholder_artwork_id  uuid not null,
  reason                  text not null
);

create table artwork_generation_failed_events (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  actor            text not null default 'system',
  correlation_id   uuid null,
  edit_id          uuid not null references episode_edits(id) on delete restrict,
  episode_id       uuid not null references episodes(id) on delete restrict,
  error            text not null
);

-- ---------------------------------------------------------------------------
-- Edit 終了（種別ごと）
-- ---------------------------------------------------------------------------
create table episode_edit_ended_events (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  actor            text not null default 'system',
  correlation_id   uuid null,
  edit_id          uuid not null references episode_edits(id) on delete restrict,
  episode_id       uuid not null references episodes(id) on delete restrict
);

create table script_edit_ended_events (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  actor            text not null default 'system',
  correlation_id   uuid null,
  edit_id          uuid not null references episode_edits(id) on delete restrict,
  episode_id       uuid not null references episodes(id) on delete restrict
);

create table audio_edit_ended_events (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  actor            text not null default 'system',
  correlation_id   uuid null,
  edit_id          uuid not null references episode_edits(id) on delete restrict,
  episode_id       uuid not null references episodes(id) on delete restrict
);

create table artwork_edit_ended_events (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  actor            text not null default 'system',
  correlation_id   uuid null,
  edit_id          uuid not null references episode_edits(id) on delete restrict,
  episode_id       uuid not null references episodes(id) on delete restrict
);

-- ---------------------------------------------------------------------------
-- 公開
-- ---------------------------------------------------------------------------
create table podcast_feed_snapshots (
  id               uuid primary key default gen_random_uuid(),
  storage_path     text not null default 'feed.xml',
  episode_count    integer not null check (episode_count >= 0),
  created_at       timestamptz not null default now()
);

create table feed_rebuilt_events (
  id                 uuid primary key default gen_random_uuid(),
  occurred_at        timestamptz not null default now(),
  actor              text not null default 'system',
  correlation_id     uuid null,
  feed_snapshot_id   uuid not null references podcast_feed_snapshots(id) on delete restrict,
  episode_count      integer not null,
  trigger_episode_id uuid null references episodes(id) on delete set null
);

create table episode_published_events (
  id                 uuid primary key default gen_random_uuid(),
  occurred_at        timestamptz not null default now(),
  actor              text not null default 'system',
  correlation_id     uuid null,
  episode_id         uuid not null references episodes(id) on delete restrict,
  edit_id            uuid not null references episode_edits(id) on delete restrict,
  outcome_kind       text not null check (outcome_kind in ('full', 'script', 'audio', 'artwork')),
  feed_snapshot_id   uuid not null references podcast_feed_snapshots(id) on delete restrict,
  publish_reason     text not null default 'first_list'
    check (publish_reason in ('first_list', 'after_content_change', 'feed_rebuild_only'))
);

create table episode_unpublished_events (
  id                 uuid primary key default gen_random_uuid(),
  occurred_at        timestamptz not null default now(),
  actor              text not null default 'operator',
  correlation_id     uuid null,
  episode_id         uuid not null references episodes(id) on delete restrict,
  reason             text not null,
  superseded_by_publication_id uuid null
);

-- ---------------------------------------------------------------------------
-- イベント間リンク（多態 — 種別テーブル id を参照）
-- ---------------------------------------------------------------------------
create table craft_event_links (
  id               uuid primary key default gen_random_uuid(),
  from_event_kind  text not null,
  from_event_id    uuid not null,
  to_event_kind    text not null,
  to_event_id      uuid not null,
  link_type        text not null check (
    link_type in (
      'precedes',
      'caused_by',
      'completes',
      'spawned_edit',
      'publishes_outcome',
      'rebuilds_feed'
    )
  ),
  created_at       timestamptz not null default now(),
  constraint craft_event_links_no_self check (
    from_event_kind <> to_event_kind or from_event_id <> to_event_id
  ),
  constraint craft_event_links_unique unique (
    from_event_kind, from_event_id, to_event_kind, to_event_id, link_type
  )
);

create index craft_event_links_from_idx
  on craft_event_links (from_event_kind, from_event_id);

create index craft_event_links_to_idx
  on craft_event_links (to_event_kind, to_event_id);

comment on column craft_event_links.from_event_kind is
  '例: episode_created, script_created, episode_edit_started, …（各 *_events 表の snake 名）';

-- ---------------------------------------------------------------------------
-- 成果物リソース（作成元イベントへの FK は一方向。event → resource id は各 event 表に保持）
-- ---------------------------------------------------------------------------
create table script_drafts (
  id                      uuid primary key default gen_random_uuid(),
  episode_id              uuid not null references episodes(id) on delete cascade,
  edit_id                 uuid not null references episode_edits(id) on delete cascade,
  content                 text not null,
  outcome                 text not null check (outcome in ('ready', 'failed')),
  error                   text null,
  llm_usage               jsonb not null default '{}'::jsonb,
  llm_response            jsonb null,
  script_created_event_id uuid not null references script_created_events(id),
  created_at              timestamptz not null default now()
);

alter table script_created_events
  add constraint script_created_events_script_draft_fk
  foreign key (script_draft_id) references script_drafts(id)
  deferrable initially deferred;

create table tts_jobs (
  id                     uuid primary key default gen_random_uuid(),
  episode_id             uuid not null references episodes(id) on delete cascade,
  edit_id                uuid not null references episode_edits(id) on delete cascade,
  script_draft_id        uuid not null references script_drafts(id) on delete restrict,
  batch_name             text not null,
  phase                  text not null check (
    phase in ('submitted', 'running', 'succeeded', 'failed', 'cancelled')
  ),
  poll_state             jsonb not null default '{}'::jsonb,
  tts_selection          jsonb null,
  tts_submitted_event_id uuid not null references tts_submitted_events(id),
  created_at             timestamptz not null default now(),
  constraint tts_jobs_batch_name_key unique (batch_name)
);

alter table tts_submitted_events
  add constraint tts_submitted_events_tts_job_fk
  foreign key (tts_job_id) references tts_jobs(id)
  deferrable initially deferred;

create table episode_audios (
  id                            uuid primary key default gen_random_uuid(),
  episode_id                    uuid not null references episodes(id) on delete cascade,
  edit_id                       uuid not null references episode_edits(id) on delete cascade,
  script_draft_id               uuid not null references script_drafts(id) on delete restrict,
  tts_job_id                    uuid not null references tts_jobs(id) on delete restrict,
  storage_path                  text not null,
  mime_type                     text not null,
  byte_size                     bigint null,
  episode_audio_created_event_id uuid not null references episode_audio_created_events(id),
  created_at                    timestamptz not null default now()
);

create table episode_artworks (
  id                          uuid primary key default gen_random_uuid(),
  episode_id                  uuid not null references episodes(id) on delete cascade,
  edit_id                     uuid not null references episode_edits(id) on delete cascade,
  script_draft_id             uuid not null references script_drafts(id) on delete restrict,
  storage_path                text not null,
  mime_type                   text not null,
  outcome                     text not null check (outcome in ('ready', 'failed', 'placeholder')),
  llm_usage                   jsonb not null default '{}'::jsonb,
  llm_response                jsonb null,
  artwork_created_event_id    uuid null references artwork_created_events(id),
  artwork_skipped_event_id    uuid null references artwork_skipped_events(id),
  created_at                  timestamptz not null default now(),
  constraint episode_artworks_one_origin check (
    (artwork_created_event_id is not null)::int + (artwork_skipped_event_id is not null)::int = 1
  )
);

alter table artwork_created_events
  add constraint artwork_created_events_artwork_fk
  foreign key (episode_artwork_id) references episode_artworks(id)
  deferrable initially deferred;

alter table artwork_skipped_events
  add constraint artwork_skipped_events_placeholder_fk
  foreign key (placeholder_artwork_id) references episode_artworks(id)
  deferrable initially deferred;

alter table episode_edits
  add constraint episode_edits_input_script_fk
  foreign key (input_script_draft_id) references script_drafts(id);

alter table audio_edit_started_events
  add constraint audio_edit_started_input_script_fk
  foreign key (input_script_draft_id) references script_drafts(id);

alter table artwork_edit_started_events
  add constraint artwork_edit_started_input_script_fk
  foreign key (input_script_draft_id) references script_drafts(id);

-- ---------------------------------------------------------------------------
-- Edit Outcome（End イベント id を保持）
-- ---------------------------------------------------------------------------
create table episode_edit_outcomes_script (
  edit_id                    uuid primary key references episode_edits(id) on delete cascade,
  episode_id                 uuid not null references episodes(id) on delete cascade,
  script_draft_id            uuid not null references script_drafts(id) on delete restrict,
  title                      text not null,
  description                text not null,
  script_edit_ended_event_id uuid not null references script_edit_ended_events(id),
  created_at                 timestamptz not null default now()
);

create table episode_edit_outcomes_audio (
  edit_id                   uuid primary key references episode_edits(id) on delete cascade,
  episode_id                uuid not null references episodes(id) on delete cascade,
  script_draft_id           uuid not null references script_drafts(id) on delete restrict,
  episode_audio_id          uuid not null references episode_audios(id) on delete restrict,
  audio_edit_ended_event_id uuid not null references audio_edit_ended_events(id),
  created_at                timestamptz not null default now()
);

create table episode_edit_outcomes_artwork (
  edit_id                      uuid primary key references episode_edits(id) on delete cascade,
  episode_id                   uuid not null references episodes(id) on delete cascade,
  script_draft_id              uuid not null references script_drafts(id) on delete restrict,
  episode_artwork_id           uuid not null references episode_artworks(id) on delete restrict,
  artwork_edit_ended_event_id  uuid not null references artwork_edit_ended_events(id),
  created_at                   timestamptz not null default now()
);

create table episode_edit_outcomes_full (
  edit_id                     uuid primary key references episode_edits(id) on delete cascade,
  episode_id                  uuid not null references episodes(id) on delete cascade,
  script_draft_id             uuid not null references script_drafts(id) on delete restrict,
  episode_audio_id            uuid not null references episode_audios(id) on delete restrict,
  episode_artwork_id          uuid not null references episode_artworks(id) on delete restrict,
  title                       text not null,
  description                 text not null,
  artwork_skipped             boolean not null default false,
  episode_edit_ended_event_id uuid not null references episode_edit_ended_events(id),
  created_at                  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 公開投影（EpisodePublished イベントと 1:1）
-- ---------------------------------------------------------------------------
create table episode_publications (
  id                        uuid primary key default gen_random_uuid(),
  episode_id                uuid not null references episodes(id) on delete cascade,
  edit_id                   uuid not null references episode_edits(id) on delete restrict,
  outcome_kind              text not null check (outcome_kind in ('full', 'script', 'audio', 'artwork')),
  feed_snapshot_id          uuid not null references podcast_feed_snapshots(id) on delete restrict,
  publish_reason            text not null,
  episode_published_event_id uuid not null references episode_published_events(id),
  published_at              timestamptz not null default now()
);

create index episode_publications_episode_id_published_at_idx
  on episode_publications (episode_id, published_at desc);

-- feed_rebuilt_events.feed_snapshot_id は podcast_feed_snapshots 作成後に INSERT

-- ---------------------------------------------------------------------------
-- RLS（代表。各 *_events 表にも同型 policy を追加）
-- ---------------------------------------------------------------------------
alter table episode_edits enable row level security;
alter table article_registered_events enable row level security;
alter table episode_created_events enable row level security;
alter table episode_edit_started_events enable row level security;
alter table script_edit_started_events enable row level security;
alter table audio_edit_started_events enable row level security;
alter table artwork_edit_started_events enable row level security;
alter table script_created_events enable row level security;
alter table script_generation_failed_events enable row level security;
alter table tts_submitted_events enable row level security;
alter table tts_job_succeeded_events enable row level security;
alter table tts_job_failed_events enable row level security;
alter table episode_audio_created_events enable row level security;
alter table episode_audio_storage_failed_events enable row level security;
alter table artwork_created_events enable row level security;
alter table artwork_skipped_events enable row level security;
alter table artwork_generation_failed_events enable row level security;
alter table episode_edit_ended_events enable row level security;
alter table script_edit_ended_events enable row level security;
alter table audio_edit_ended_events enable row level security;
alter table artwork_edit_ended_events enable row level security;
alter table episode_published_events enable row level security;
alter table feed_rebuilt_events enable row level security;
alter table episode_unpublished_events enable row level security;
alter table craft_event_links enable row level security;
alter table script_drafts enable row level security;
alter table tts_jobs enable row level security;
alter table episode_audios enable row level security;
alter table episode_artworks enable row level security;
alter table episode_edit_outcomes_script enable row level security;
alter table episode_edit_outcomes_audio enable row level security;
alter table episode_edit_outcomes_artwork enable row level security;
alter table episode_edit_outcomes_full enable row level security;
alter table podcast_feed_snapshots enable row level security;
alter table episode_publications enable row level security;

create policy "service role insert episode_edits"
  on episode_edits for insert to service_role with check (true);
create policy "service role update episode_edits"
  on episode_edits for update to service_role using (true) with check (true);
create policy "authenticated read episode_edits"
  on episode_edits for select to authenticated using (true);

-- 各 event 表: insert service_role, select authenticated（migration 生成時に macro 化可）

-- ---------------------------------------------------------------------------
-- craft_event_links.from_event_kind / to_event_kind 許容値
-- ---------------------------------------------------------------------------
-- article_registered, episode_created,
-- episode_edit_started, script_edit_started, audio_edit_started, artwork_edit_started,
-- script_created, script_generation_failed,
-- tts_submitted, tts_job_succeeded, tts_job_failed,
-- episode_audio_created, episode_audio_storage_failed,
-- artwork_created, artwork_skipped, artwork_generation_failed,
-- episode_edit_ended, script_edit_ended, audio_edit_ended, artwork_edit_ended,
-- episode_published, feed_rebuilt, episode_unpublished
