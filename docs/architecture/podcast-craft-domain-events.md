# ドメインイベント — テーブル定義

to-be の **Craft 境界** ドメインイベントを一覧する。実行可能 DDL は **[podcast-craft-domain-events-schema.sql](./podcast-craft-domain-events-schema.sql)**。

運用テレメトリ（`processing_logs`）と Job Execution（`craft_workflow_runs` / `craft_step_runs`）は **ドメインイベントではない** — [target-model](./podcast-craft-target-model.md) の B/C 層。

---

## テーブル一覧

| テーブル | 役割 | 更新 |
|----------|------|------|
| `episode_edits` | Edit セッション | Started で INSERT、`ended_at` / `status` の UPDATE のみ |
| `craft_domain_events` | **全ドメインイベント** append-only | INSERT のみ |
| `episode_edit_outcomes_*` | `*EditEnded` の sealed 結果 | INSERT のみ（End 時 1 行） |
| `podcast_feed_snapshots` | `FeedRebuilt` の成果 | INSERT のみ |
| `episode_publications` | `EpisodePublished` の投影 | INSERT のみ |

成果物本体（`script_drafts` / `tts_jobs` / `episode_audios` / `episode_artworks`）は別 migration。イベント payload と outcome が UUID で参照する。

---

## `craft_domain_events`

| 列 | 型 | 説明 |
|----|-----|------|
| `id` | uuid PK | |
| `sequence_no` | bigint identity | 全体順序 |
| `event_type` | text | 下表 CHECK |
| `occurred_at` | timestamptz | |
| `article_id` | uuid FK | ingest 系 |
| `episode_id` | uuid FK | |
| `edit_id` | uuid FK | Edit セッション内イベント |
| `actor` | text | system / operator / ingest / workflow |
| `correlation_id` | uuid | ワークフロー相関 |
| `payload` | jsonb | 型ごと契約（SQL ファイル末尾コメント） |

---

## イベント型一覧

### Ingest / Identity

| event_type | いつ | payload 必須キー |
|------------|------|-------------------|
| `ArticleRegistered` | ingest | `content_path?`, `content_sha?`, `ingest_route?` |
| `EpisodeCreated` | ingest で episode INSERT 後 | — |

### Edit 開始

| event_type | kind | payload |
|------------|------|---------|
| `EpisodeEditStarted` | episode | `trigger`, `workflow_run_id?` |
| `ScriptEditStarted` | script | `trigger` |
| `AudioEditStarted` | audio | `trigger`, `input_script_draft_id` |
| `ArtworkEditStarted` | artwork | `trigger`, `input_script_draft_id` |

### Edit 中 — 台本

| event_type | payload |
|------------|---------|
| `ScriptCreated` | `script_draft_id`, `title`, `description` |
| `ScriptGenerationFailed` | `error`, `script_draft_id?` |

### Edit 中 — 音声

| event_type | payload |
|------------|---------|
| `TtsSubmitted` | `tts_job_id`, `batch_name`, `script_draft_id` |
| `TtsJobSucceeded` | `tts_job_id`, `batch_name` |
| `TtsJobFailed` | `tts_job_id`, `error` |
| `EpisodeAudioCreated` | `episode_audio_id`, `tts_job_id`, `storage_path`, `mime_type` |
| `EpisodeAudioStorageFailed` | `tts_job_id`, `error` |

### Edit 中 — アートワーク

| event_type | payload |
|------------|---------|
| `ArtworkCreated` | `episode_artwork_id`, `storage_path`, `mime_type` |
| `ArtworkSkipped` | `reason`, `placeholder_artwork_id` |
| `ArtworkGenerationFailed` | `error` |

### Edit 終了

| event_type | outcome 表 | payload |
|------------|--------------|---------|
| `EpisodeEditEnded` | `episode_edit_outcomes_full` | `outcome_kind: full` |
| `ScriptEditEnded` | `episode_edit_outcomes_script` | `outcome_kind: script` |
| `AudioEditEnded` | `episode_edit_outcomes_audio` | `outcome_kind: audio` |
| `ArtworkEditEnded` | `episode_edit_outcomes_artwork` | `outcome_kind: artwork` |

End 処理: 同一トランザクションで **outcome 行 INSERT** + `episode_edits.status = ended` + 本イベント INSERT（`domain_event_id` 相互参照）。

### 公開

| event_type | 投影 | payload |
|------------|------|---------|
| `EpisodePublished` | `episode_publications` | `outcome_kind`, `publish_reason`, `feed_snapshot_id` |
| `FeedRebuilt` | `podcast_feed_snapshots` | `episode_count`, `trigger_episode_id?` |

| event_type | 備考 |
|------------|------|
| `EpisodeUnpublished` | 将来。payload: `reason`, `superseded_by_publication_id?` |

---

## Outcome 表（NOT NULL）

| 表 | 列（すべて NOT NULL  unless noted） |
|----|-------------------------------------|
| `episode_edit_outcomes_script` | edit_id PK, episode_id, script_draft_id, title, description, domain_event_id |
| `episode_edit_outcomes_audio` | edit_id PK, episode_id, script_draft_id, episode_audio_id, domain_event_id |
| `episode_edit_outcomes_artwork` | edit_id PK, episode_id, script_draft_id, episode_artwork_id, domain_event_id |
| `episode_edit_outcomes_full` | edit_id PK, episode_id, script_draft_id, episode_audio_id, episode_artwork_id, title, description, artwork_skipped, domain_event_id |

---

## 典型イベント列（再掲）

```text
EpisodeEditStarted → ScriptCreated → TtsSubmitted → EpisodeAudioCreated
  → ArtworkCreated | ArtworkSkipped → EpisodeEditEnded → EpisodePublished + FeedRebuilt

AudioEditStarted → TtsSubmitted → EpisodeAudioCreated → AudioEditEnded → EpisodePublished
```

---

## 参照

- [edit-sessions](./podcast-craft-edit-sessions.md)
- [podcast-craft-domain-events-schema.sql](./podcast-craft-domain-events-schema.sql)
