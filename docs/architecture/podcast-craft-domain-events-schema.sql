-- Podcast craft — ドメインイベント関連 DDL（to-be）
-- 設計: docs/architecture/podcast-craft-edit-sessions.md
--       docs/architecture/podcast-craft-target-model.md
--
-- 適用前に /security-review。本ファイルは設計用。適用は新規 migration として切り出すこと。
-- 既存 scripts / audio_files / episodes 列とは別 Phase で移行。

-- ---------------------------------------------------------------------------
-- イベント型（参照用。アプリ enum と同期）
-- ---------------------------------------------------------------------------
-- Ingest / Identity
--   ArticleRegistered
--   EpisodeCreated
-- Edit セッション開始
--   EpisodeEditStarted | ScriptEditStarted | AudioEditStarted | ArtworkEditStarted
-- Edit セッション内
--   ScriptCreated | ScriptGenerationFailed
--   TtsSubmitted | TtsJobSucceeded | TtsJobFailed
--   EpisodeAudioCreated | EpisodeAudioStorageFailed
--   ArtworkCreated | ArtworkSkipped | ArtworkGenerationFailed
-- Edit セッション終了
--   EpisodeEditEnded | ScriptEditEnded | AudioEditEnded | ArtworkEditEnded
-- 公開（チャンネル）
--   EpisodePublished
--   FeedRebuilt
-- 将来
--   EpisodeUnpublished

-- ---------------------------------------------------------------------------
-- 編集セッション（イベントの束ね。Started で INSERT、Ended で status 更新のみ）
-- ---------------------------------------------------------------------------
create table episode_edits (
  id            uuid primary key default gen_random_uuid(),
  episode_id    uuid not null references episodes(id) on delete cascade,
  kind          text not null check (
    kind in ('episode', 'script', 'audio', 'artwork')
  ),
  status        text not null default 'started' check (
    status in ('started', 'ended', 'failed', 'cancelled')
  ),
  trigger       text not null default 'manual' check (
    trigger in ('ingest', 'manual', 'queued', 'monitor')
  ),
  -- AudioEditStarted / ArtworkEditStarted 等の入力
  input_script_draft_id uuid null,
  workflow_run_id uuid null,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz null,
  failure_message text null
);

create index episode_edits_episode_id_started_at_idx
  on episode_edits (episode_id, started_at desc);

create index episode_edits_episode_id_status_idx
  on episode_edits (episode_id, status)
  where status = 'started';

comment on table episode_edits is
  'Edit セッション。進行中は status=started が 0〜1 件 / episode（ドメインルール）';

alter table episode_edits enable row level security;

-- ---------------------------------------------------------------------------
-- ドメインイベント（append-only・単一ログ）
-- ---------------------------------------------------------------------------
create table craft_domain_events (
  id              uuid primary key default gen_random_uuid(),
  sequence_no     bigint generated always as identity,
  event_type      text not null,
  occurred_at     timestamptz not null default now(),

  -- 主要な外部キー（payload とも整合させる）
  article_id      uuid null references articles(id) on delete set null,
  episode_id      uuid null references episodes(id) on delete set null,
  edit_id         uuid null references episode_edits(id) on delete set null,

  -- イベント共通メタ
  actor           text not null default 'system' check (
    actor in ('system', 'operator', 'ingest', 'workflow')
  ),
  correlation_id  uuid null,
  payload         jsonb not null default '{}'::jsonb,

  constraint craft_domain_events_event_type_check check (
    event_type in (
      'ArticleRegistered',
      'EpisodeCreated',
      'EpisodeEditStarted',
      'ScriptEditStarted',
      'AudioEditStarted',
      'ArtworkEditStarted',
      'ScriptCreated',
      'ScriptGenerationFailed',
      'TtsSubmitted',
      'TtsJobSucceeded',
      'TtsJobFailed',
      'EpisodeAudioCreated',
      'EpisodeAudioStorageFailed',
      'ArtworkCreated',
      'ArtworkSkipped',
      'ArtworkGenerationFailed',
      'EpisodeEditEnded',
      'ScriptEditEnded',
      'AudioEditEnded',
      'ArtworkEditEnded',
      'EpisodePublished',
      'FeedRebuilt',
      'EpisodeUnpublished'
    )
  )
);

create index craft_domain_events_episode_id_occurred_at_idx
  on craft_domain_events (episode_id, occurred_at desc)
  where episode_id is not null;

create index craft_domain_events_edit_id_sequence_idx
  on craft_domain_events (edit_id, sequence_no asc)
  where edit_id is not null;

create index craft_domain_events_event_type_occurred_at_idx
  on craft_domain_events (event_type, occurred_at desc);

create index craft_domain_events_payload_gin_idx
  on craft_domain_events using gin (payload);

comment on table craft_domain_events is
  'Craft 境界のドメインイベント。UPDATE/DELETE 禁止（トリガまたは権限で防御）';

alter table craft_domain_events enable row level security;

-- ---------------------------------------------------------------------------
-- イベント間リレーション（有向グラフ・append-only）
-- ---------------------------------------------------------------------------
create table craft_domain_event_links (
  id              uuid primary key default gen_random_uuid(),
  from_event_id   uuid not null references craft_domain_events(id) on delete restrict,
  to_event_id     uuid not null references craft_domain_events(id) on delete restrict,
  link_type       text not null check (
    link_type in (
      'precedes',           -- 同一 edit 内の時系列（to が後）
      'caused_by',          -- to が from の直接的結果
      'completes',          -- Edit*Ended completes Edit*Started（edit_id 一致）
      'spawned_edit',       -- EpisodeCreated → *EditStarted 等
      'publishes_outcome',  -- EpisodePublished → Edit*Ended
      'rebuilds_feed'       -- FeedRebuilt → EpisodePublished（同一 UC 内）
    )
  ),
  created_at      timestamptz not null default now(),
  constraint craft_domain_event_links_no_self check (from_event_id <> to_event_id),
  constraint craft_domain_event_links_unique unique (from_event_id, to_event_id, link_type)
);

create index craft_domain_event_links_from_idx
  on craft_domain_event_links (from_event_id);

create index craft_domain_event_links_to_idx
  on craft_domain_event_links (to_event_id);

comment on table craft_domain_event_links is
  'ドメインイベント間の明示的エッジ。DAG / セッション順序 / 因果';

alter table craft_domain_event_links enable row level security;

-- ---------------------------------------------------------------------------
-- イベント ↔ リソース（produces / uses / references）
-- ---------------------------------------------------------------------------
create table craft_domain_event_resources (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references craft_domain_events(id) on delete restrict,
  resource_kind   text not null check (
    resource_kind in (
      'article',
      'episode',
      'edit',
      'script_draft',
      'tts_job',
      'episode_audio',
      'episode_artwork',
      'feed_snapshot',
      'publication'
    )
  ),
  resource_id     uuid not null,
  resource_role   text not null check (
    resource_role in (
      'creates',      -- イベントが INSERT した成果物
      'uses_input',   -- 入力として参照（AudioEdit の script 等）
      'updates',      -- TtsJobSucceeded が tts_job phase を更新した、等
      'materializes', -- EditEnded が outcome 行を materialize
      'references'    -- Publish が outcome / feed を参照
    )
  ),
  created_at      timestamptz not null default now(),
  constraint craft_domain_event_resources_unique
    unique (event_id, resource_kind, resource_id, resource_role)
);

create index craft_domain_event_resources_resource_idx
  on craft_domain_event_resources (resource_kind, resource_id);

alter table craft_domain_event_resources enable row level security;

-- ---------------------------------------------------------------------------
-- 成果物リソース
-- ---------------------------------------------------------------------------
create table script_drafts (
  id                  uuid primary key default gen_random_uuid(),
  episode_id          uuid not null references episodes(id) on delete cascade,
  edit_id             uuid not null references episode_edits(id) on delete cascade,
  content             text not null,
  outcome             text not null check (outcome in ('ready', 'failed')),
  error               text null,
  llm_usage           jsonb not null default '{}'::jsonb,
  llm_response        jsonb null,
  created_by_event_id uuid not null references craft_domain_events(id),
  created_at          timestamptz not null default now()
);

create table tts_jobs (
  id                  uuid primary key default gen_random_uuid(),
  episode_id          uuid not null references episodes(id) on delete cascade,
  edit_id             uuid not null references episode_edits(id) on delete cascade,
  script_draft_id     uuid not null references script_drafts(id) on delete restrict,
  batch_name          text not null,
  phase               text not null check (
    phase in ('submitted', 'running', 'succeeded', 'failed', 'cancelled')
  ),
  poll_state          jsonb not null default '{}'::jsonb,
  tts_selection       jsonb null,
  submitted_by_event_id uuid not null references craft_domain_events(id),
  created_at          timestamptz not null default now(),
  constraint tts_jobs_batch_name_key unique (batch_name)
);

create table episode_audios (
  id                  uuid primary key default gen_random_uuid(),
  episode_id          uuid not null references episodes(id) on delete cascade,
  edit_id             uuid not null references episode_edits(id) on delete cascade,
  script_draft_id     uuid not null references script_drafts(id) on delete restrict,
  tts_job_id          uuid not null references tts_jobs(id) on delete restrict,
  storage_path        text not null,
  mime_type           text not null,
  byte_size           bigint null,
  created_by_event_id uuid not null references craft_domain_events(id),
  created_at          timestamptz not null default now()
);

create table episode_artworks (
  id                  uuid primary key default gen_random_uuid(),
  episode_id          uuid not null references episodes(id) on delete cascade,
  edit_id             uuid not null references episode_edits(id) on delete cascade,
  script_draft_id     uuid not null references script_drafts(id) on delete restrict,
  storage_path        text not null,
  mime_type           text not null,
  outcome             text not null check (outcome in ('ready', 'failed', 'placeholder')),
  llm_usage           jsonb not null default '{}'::jsonb,
  llm_response        jsonb null,
  created_by_event_id uuid not null references craft_domain_events(id),
  created_at          timestamptz not null default now()
);

alter table episode_edits
  add column started_by_event_id uuid null references craft_domain_events(id),
  add column ended_by_event_id uuid null references craft_domain_events(id);

alter table episode_edits
  add constraint episode_edits_input_script_fk
  foreign key (input_script_draft_id) references script_drafts(id);

alter table script_drafts enable row level security;
alter table tts_jobs enable row level security;
alter table episode_audios enable row level security;
alter table episode_artworks enable row level security;

-- ---------------------------------------------------------------------------
-- Edit Outcome（Edit*Ended の結果。イベントではなく End の永続化 — Publish が参照）
-- ---------------------------------------------------------------------------
create table episode_edit_outcomes_script (
  edit_id           uuid primary key references episode_edits(id) on delete cascade,
  episode_id        uuid not null references episodes(id) on delete cascade,
  script_draft_id   uuid not null references script_drafts(id) on delete restrict,
  title             text not null,
  description       text not null,
  domain_event_id   uuid not null references craft_domain_events(id),
  created_at        timestamptz not null default now()
);

create table episode_edit_outcomes_audio (
  edit_id             uuid primary key references episode_edits(id) on delete cascade,
  episode_id          uuid not null references episodes(id) on delete cascade,
  script_draft_id     uuid not null references script_drafts(id) on delete restrict,
  episode_audio_id    uuid not null references episode_audios(id) on delete restrict,
  domain_event_id     uuid not null references craft_domain_events(id),
  created_at          timestamptz not null default now()
);

create table episode_edit_outcomes_artwork (
  edit_id               uuid primary key references episode_edits(id) on delete cascade,
  episode_id            uuid not null references episodes(id) on delete cascade,
  script_draft_id       uuid not null references script_drafts(id) on delete restrict,
  episode_artwork_id    uuid not null references episode_artworks(id) on delete restrict,
  domain_event_id       uuid not null references craft_domain_events(id),
  created_at            timestamptz not null default now()
);

create table episode_edit_outcomes_full (
  edit_id               uuid primary key references episode_edits(id) on delete cascade,
  episode_id            uuid not null references episodes(id) on delete cascade,
  script_draft_id       uuid not null references script_drafts(id) on delete restrict,
  episode_audio_id      uuid not null references episode_audios(id) on delete restrict,
  episode_artwork_id    uuid not null references episode_artworks(id) on delete restrict,
  title                 text not null,
  description           text not null,
  artwork_skipped       boolean not null default false,
  domain_event_id       uuid not null references craft_domain_events(id),
  created_at            timestamptz not null default now()
);

comment on table episode_edit_outcomes_full is
  'EpisodeEditEnded の sealed 結果。artwork_skipped=true のときも episode_artwork_id は default 等の非 NULL 参照';

alter table episode_edit_outcomes_script enable row level security;
alter table episode_edit_outcomes_audio enable row level security;
alter table episode_edit_outcomes_artwork enable row level security;
alter table episode_edit_outcomes_full enable row level security;

-- ---------------------------------------------------------------------------
-- 公開イベントの投影（EpisodePublished — outcome 参照）
-- ---------------------------------------------------------------------------
create table podcast_feed_snapshots (
  id              uuid primary key default gen_random_uuid(),
  storage_path    text not null default 'feed.xml',
  episode_count   integer not null check (episode_count >= 0),
  domain_event_id uuid not null references craft_domain_events(id),
  created_at      timestamptz not null default now()
);

alter table podcast_feed_snapshots enable row level security;

create table episode_publications (
  id                uuid primary key default gen_random_uuid(),
  episode_id        uuid not null references episodes(id) on delete cascade,
  edit_id           uuid not null references episode_edits(id) on delete restrict,
  outcome_kind      text not null check (
    outcome_kind in ('full', 'script', 'audio', 'artwork')
  ),
  feed_snapshot_id  uuid not null references podcast_feed_snapshots(id) on delete restrict,
  publish_reason    text not null default 'first_list' check (
    publish_reason in (
      'first_list',
      'after_content_change',
      'feed_rebuild_only'
    )
  ),
  domain_event_id   uuid not null references craft_domain_events(id),
  published_at      timestamptz not null default now()
);

create index episode_publications_episode_id_published_at_idx
  on episode_publications (episode_id, published_at desc);

alter table episode_publications enable row level security;

-- ---------------------------------------------------------------------------
-- RLS（processing_logs と同型）
-- ---------------------------------------------------------------------------
create policy "service role insert craft_domain_events"
  on craft_domain_events for insert to service_role with check (true);

create policy "authenticated read craft_domain_events"
  on craft_domain_events for select to authenticated using (true);

create policy "service role insert craft_domain_event_links"
  on craft_domain_event_links for insert to service_role with check (true);

create policy "authenticated read craft_domain_event_links"
  on craft_domain_event_links for select to authenticated using (true);

create policy "service role insert craft_domain_event_resources"
  on craft_domain_event_resources for insert to service_role with check (true);

create policy "authenticated read craft_domain_event_resources"
  on craft_domain_event_resources for select to authenticated using (true);

create policy "service role insert script_drafts"
  on script_drafts for insert to service_role with check (true);

create policy "authenticated read script_drafts"
  on script_drafts for select to authenticated using (true);

create policy "service role insert tts_jobs"
  on tts_jobs for insert to service_role with check (true);

create policy "service role update tts_jobs"
  on tts_jobs for update to service_role using (true) with check (true);

create policy "authenticated read tts_jobs"
  on tts_jobs for select to authenticated using (true);

create policy "service role insert episode_audios"
  on episode_audios for insert to service_role with check (true);

create policy "authenticated read episode_audios"
  on episode_audios for select to authenticated using (true);

create policy "service role insert episode_artworks"
  on episode_artworks for insert to service_role with check (true);

create policy "authenticated read episode_artworks"
  on episode_artworks for select to authenticated using (true);

create policy "service role insert episode_edits"
  on episode_edits for insert to service_role with check (true);

create policy "service role update episode_edits"
  on episode_edits for update to service_role using (true) with check (true);

create policy "authenticated read episode_edits"
  on episode_edits for select to authenticated using (true);

create policy "service role insert episode_edit_outcomes"
  on episode_edit_outcomes_script for insert to service_role with check (true);

create policy "service role insert episode_edit_outcomes_audio"
  on episode_edit_outcomes_audio for insert to service_role with check (true);

create policy "service role insert episode_edit_outcomes_artwork"
  on episode_edit_outcomes_artwork for insert to service_role with check (true);

create policy "service role insert episode_edit_outcomes_full"
  on episode_edit_outcomes_full for insert to service_role with check (true);

create policy "authenticated read episode_edit_outcomes_script"
  on episode_edit_outcomes_script for select to authenticated using (true);

create policy "authenticated read episode_edit_outcomes_audio"
  on episode_edit_outcomes_audio for select to authenticated using (true);

create policy "authenticated read episode_edit_outcomes_artwork"
  on episode_edit_outcomes_artwork for select to authenticated using (true);

create policy "authenticated read episode_edit_outcomes_full"
  on episode_edit_outcomes_full for select to authenticated using (true);

create policy "service role insert podcast_feed_snapshots"
  on podcast_feed_snapshots for insert to service_role with check (true);

create policy "authenticated read podcast_feed_snapshots"
  on podcast_feed_snapshots for select to authenticated using (true);

create policy "service role insert episode_publications"
  on episode_publications for insert to service_role with check (true);

create policy "authenticated read episode_publications"
  on episode_publications for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- payload JSON 契約（イベント型ごと）
-- ---------------------------------------------------------------------------
-- ArticleRegistered
--   content_path?, content_sha?, ingest_route?, source?
--
-- EpisodeCreated
--   (empty or mem_note_id?)
--
-- *EditStarted (Episode|Script|Audio|Artwork)
--   kind, trigger, input_script_draft_id?, workflow_run_id?
--
-- ScriptCreated
--   script_draft_id, title, description, token_usage?
--
-- ScriptGenerationFailed
--   error, script_draft_id?
--
-- TtsSubmitted
--   tts_job_id, batch_name, script_draft_id, request_count?
--
-- TtsJobSucceeded | TtsJobFailed
--   tts_job_id, batch_name, error?, poll_count?
--
-- EpisodeAudioCreated
--   episode_audio_id, tts_job_id, storage_path, mime_type, byte_size?
--
-- EpisodeAudioStorageFailed
--   tts_job_id, error
--
-- ArtworkCreated
--   episode_artwork_id, storage_path, mime_type
--
-- ArtworkSkipped
--   reason: disabled | failed_non_fatal | ...
--   placeholder_artwork_id  -- NULL 禁止ポリシー用
--
-- ArtworkGenerationFailed
--   error
--
-- *EditEnded
--   outcome_kind: full|script|audio|artwork
--   (outcome 行は別表。domain_event_id 相互参照)
--
-- EpisodePublished
--   outcome_kind, publish_reason, feed_snapshot_id
--
-- FeedRebuilt
--   feed_snapshot_id, episode_count, trigger_episode_id?
--
-- EpisodeUnpublished
--   reason?, superseded_by_publication_id?
--
-- ---------------------------------------------------------------------------
-- イベント間リンク（ドメイン上の必須エッジ — 例）
-- ---------------------------------------------------------------------------
-- ArticleRegistered --precedes--> EpisodeCreated
-- EpisodeCreated --spawned_edit--> EpisodeEditStarted
-- EpisodeEditStarted --precedes--> ScriptCreated | TtsSubmitted | ArtworkCreated ...
-- ScriptCreated --caused_by--> (produces script_draft via event_resources)
-- ScriptCreated --precedes--> TtsSubmitted
-- TtsSubmitted --uses_input--> script_draft
-- TtsSubmitted --caused_by--> (creates tts_job)
-- TtsJobSucceeded --updates--> tts_job
-- TtsJobSucceeded --precedes--> EpisodeAudioCreated
-- EpisodeAudioCreated --creates--> episode_audio
-- ArtworkCreated --creates--> episode_artwork
-- EpisodeEditStarted --completes--> EpisodeEditEnded (逆: End completes Start)
-- EpisodeEditEnded --materializes--> outcome (event_resources)
-- EpisodePublished --publishes_outcome--> EpisodeEditEnded
-- EpisodePublished --references--> feed_snapshot (via event_resources)
-- FeedRebuilt --rebuilds_feed--> EpisodePublished (同一トランザクション内)
-- FeedRebuilt --creates--> feed_snapshot
