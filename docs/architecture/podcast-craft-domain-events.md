# ドメインイベント — テーブル定義

**方針**: 汎用 `craft_domain_events` は使わない。**イベント種別ごとに専用テーブル**（1 イベント = 1 行 = 1 エンティティ）。

**リンク**: 別表のエッジは持たない。**後続イベント行が `previous_event_kind` + `previous_event_id` で直前イベントを参照**する（後方リンク）。必要な箇所は **型付き FK 列**（`previous_script_created_event_id` 等）も併記し、`previous_*` と一致させる。

DDL: [podcast-craft-domain-events-schema.sql](./podcast-craft-domain-events-schema.sql)

---

## 共通列

| 列 | 説明 |
|----|------|
| `id`, `occurred_at`, `actor`, `correlation_id` | 全 `*_events` 表 |
| `previous_event_kind` | 直前イベントの kind（snake、`_events` なし）。`article_registered_events` のみ NULL |
| `previous_event_id` | 直前イベント行の PK |
| `merge_previous_event_kind` / `merge_previous_event_id` | **`episode_edit_ended_events` のみ** — 音声枝とアートワーク枝の DAG 合流 |

鎖の向き: **新しい行 → 古い行**（`SELECT ... WHERE id = :previous_event_id` で 1 手戻る）。

---

## テーブル一覧

（23 イベント + 成果物 + 投影。`craft_event_links` は **廃止**。）

### Ingest

| テーブル | 後方リンク |
|----------|------------|
| `article_registered_events` | なし（起点） |
| `episode_created_events` | `article_registered_event_id`（= `previous_*`） |

### Edit 開始〜終了・公開

各表に `previous_event_kind` / `previous_event_id`。音声 TTS 鎖など固定順序は型付き FK 付き（SQL 参照）。

---

## 直前イベントの期待値（フル edit の例）

| イベント表 | 典型的な `previous_event_kind` | 備考 |
|------------|-------------------------------|------|
| `episode_created_events` | `article_registered` | 型付き FK |
| `episode_edit_started_events` | `episode_created` | 型付き FK |
| `script_created_events` | `episode_edit_started` または `script_edit_started` | XOR 型付き FK |
| `tts_submitted_events` | `script_created` | 型付き FK |
| `tts_job_succeeded_events` / `tts_job_failed_events` | `tts_submitted` | 型付き FK |
| `episode_audio_created_events` | `tts_job_succeeded` | 型付き FK |
| `artwork_created_events` / `artwork_skipped_events` | `script_created` または `episode_edit_started` | 並列枝 |
| `episode_edit_ended_events` | 音声枝の末尾（例: `episode_audio_created`） | `merge_previous_*` にアートワーク枝 |
| `episode_published_events` | `episode_edit_ended` 等（outcome に応じる） | 型付き FK は migration で種別ごとに追加可 |
| `feed_rebuilt_events` | `episode_published` | 型付き FK |

再生成 Edit（`script_edit_started` / `audio_edit_started` / `artwork_edit_started`）は、トリガー元（直前の `episode_published` や `*_edit_ended` 等）を `previous_*` に記録する。

---

## 成果物 ↔ イベント

| リソース | 作成イベント FK |
|----------|-----------------|
| `script_drafts` | `script_created_event_id` |
| `tts_jobs` | `tts_submitted_event_id` |
| `episode_audios` | `episode_audio_created_event_id` |
| `episode_artworks` | `artwork_created_event_id` または `artwork_skipped_event_id` |

---

## ER 図（後方リンク + リソース）

```mermaid
erDiagram
  ARTICLE_REGISTERED_EVENT ||--o{ EPISODE_CREATED_EVENT : "previous"
  EPISODE_CREATED_EVENT ||--o{ EPISODE_EDIT_STARTED_EVENT : "previous"
  EPISODE_EDIT_STARTED_EVENT ||--o{ SCRIPT_CREATED_EVENT : "previous"
  SCRIPT_CREATED_EVENT ||--o{ TTS_SUBMITTED_EVENT : "previous"
  TTS_SUBMITTED_EVENT ||--o{ TTS_JOB_SUCCEEDED_EVENT : "previous"
  TTS_JOB_SUCCEEDED_EVENT ||--o{ EPISODE_AUDIO_CREATED_EVENT : "previous"
  EPISODE_EDIT_STARTED_EVENT ||--o{ ARTWORK_CREATED_EVENT : "previous"
  EPISODE_AUDIO_CREATED_EVENT ||--o{ EPISODE_EDIT_ENDED_EVENT : "previous"
  ARTWORK_CREATED_EVENT ||--o{ EPISODE_EDIT_ENDED_EVENT : "merge_previous"
  EPISODE_EDIT_ENDED_EVENT ||--o{ EPISODE_PUBLISHED_EVENT : "previous"
  EPISODE_PUBLISHED_EVENT ||--o{ FEED_REBUILT_EVENT : "previous"

  SCRIPT_CREATED_EVENT ||--|| SCRIPT_DRAFT : creates
  TTS_SUBMITTED_EVENT ||--|| TTS_JOB : creates
  EPISODE_AUDIO_CREATED_EVENT ||--|| EPISODE_AUDIO : creates
  ARTWORK_CREATED_EVENT ||--|| EPISODE_ARTWORK : creates
  EPISODE_EDIT_ENDED_EVENT ||--|| OUTCOME_FULL : materializes
  EPISODE_PUBLISHED_EVENT ||--o{ EPISODE_PUBLICATION : projects
```

ラベル `previous` / `merge_previous` は **後続行の列** を表す（ER 上は子 → 親の読み方）。

---

## フル edit の鎖（後方リンクのイメージ）

```mermaid
flowchart LR
  AR[article_registered]
  EC[episode_created]
  EES[episode_edit_started]
  SC[script_created]
  TS[tts_submitted]
  TJS[tts_job_succeeded]
  EAC[episode_audio_created]
  AC[artwork_created]
  EEE[episode_edit_ended]
  EP[episode_published]
  FR[feed_rebuilt]

  EC -->|previous| AR
  EES -->|previous| EC
  SC -->|previous| EES
  TS -->|previous| SC
  TJS -->|previous| TS
  EAC -->|previous| TJS
  AC -->|previous| SC
  EEE -->|previous| EAC
  EEE -->|merge_previous| AC
  EP -->|previous| EEE
  FR -->|previous| EP
```

矢印は **後続イベントが指す直前**（行の `previous_*` / `merge_previous_*`）。

---

## 廃止したもの

| 旧 | 新 |
|----|-----|
| `craft_domain_events` | 種別ごと `*_events` 表 |
| `craft_domain_event_resources` | event / resource 表の直接 FK |
| `craft_domain_event_links` / `craft_event_links` | 各イベント行の **`previous_event_*`** |

---

## 参照

- [edit-sessions](./podcast-craft-edit-sessions.md)
- [podcast-craft-domain-events-schema.sql](./podcast-craft-domain-events-schema.sql)
