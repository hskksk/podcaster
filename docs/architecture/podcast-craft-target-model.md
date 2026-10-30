# ポッドキャスト制作 — 目標ドメインモデル

[現状整理](./podcast-craft-domain.md) の続き。**エンティティ分解**、**ドメインイベント**、**ジョブ実行レイヤー**を、PostgreSQL / pgflow の上に載せる前提で定義する。本章は to-be である。マイグレーションは段階的に行う。

## 現状モデルが甘い理由

| 症状 | 例 | 問題 |
|------|-----|------|
| Episode が成果物を抱え込む | `image_url`、`audio_url`、制作 `status`、公開 `published_at` | 集約が肥大化し、再生成・公開のルールが列更新に散在 |
| 1 テーブルにジョブと成果物 | `audio_files` が pending（バッチ）と ready（WAV）を兼ねる | TTS ジョブのライフサイクルと「配信用音声」が同じ行 |
| 「イベント」が混線 | `scripts` / `audio_files` の insert、`processing_logs` | ドメイン上の出来事・試行履歴・運用ログが区別されていない |
| オーケストレーション漏れ | Edge / CLI が直接 `pgflow.start_flow` + `startFrom` | ユースケースが pgflow DSL と PostgreSQL extension に結合 |

Web は RSS と同様 **`audio_files.storage_path` を正**としつつ、REST ではまだ `episodes.audio_url` を読む箇所がある（ingest 時に仮パスを入れるだけ）。**公開 URL の正本は Audio 成果物側に寄せる**のが to-be の方向。

---

## 境界の再定義（4 + 1 層）

```text
  [Application]  ユースケース命令（RegenerateArtwork など）
        │
  [Domain]       集約・ドメインイベント・WorkOrder
        │
  [Job Execution]  WorkflowRun / StepRun（ドメインが所有する実行記録）
        │
  [Job Runner Port]  インターフェースのみ（pgflow 非依存）
        │
  [Infrastructure]  PgflowAdapter, pg_cron → PollTts, EdgeWorker
```

- **pgflow / pgmq / pg_cron** はインフラの「ジョブ実行エンジン」に降格する。
- ドメインは `WorkflowKind.SubmitProduction` のような **意図**だけ知り、`craftEpisodeSubmit` という slug は Adapter が解決する。

---

## Episode のイミュータブル化

### 何が「イミュータブルでない」か

現行 `episodes` は 1 行を何度も `UPDATE` する。

- 台本後に `title` / `description` / `status`
- 画像・音声・公開で `image_url` / 間接的に音声 / `published_at` / `status`

to-be の前稿も **`current_*` ポインタと phase を Episode 行に載せる** 形で、本質的には可変レコードのままだった。

**直し方**: Episode を **身份（Identity）だけの不変レコード** にし、中身は **Revision（追記のみ）**。**公開エピソード**は **`EpisodePublished` イベント（追記のみ）** が指す `revision_id` だけで定義する。`listed_revision_id` や `publication_phase` を UPDATE する Cursor は不要。

制作中の「今どこまで進んだか」は **進行中ジョブ（TtsJob / WorkflowRun）から導出**するか、クエリコストが高ければ **任意の `episode_production_state`（phase だけ 1 行）** に縮退する。後者は Cursor より狭い。

### 2 + 1 モデル（Cursor なし）

| 概念 | テーブル案 | 更新 | 役割 |
|------|------------|------|------|
| **EpisodeIdentity** | `episodes` | INSERT のみ | `id`, `article_id`, `created_at` |
| **EpisodeRevision** | `episode_revisions` | INSERT のみ | 制作上のスナップショット（追記のたびに revision_no++） |
| **EpisodePublished** | `episode_publications` | INSERT のみ | **公開イベント**。掲載版 revision を固定参照 |

```text
episodes (immutable)
  id, article_id, created_at

episode_revisions (immutable, append)
  id, episode_id, revision_no
  title, description
  script_draft_id, episode_audio_id, episode_artwork_id
  created_at, cause

episode_publications (immutable, append)   ← 「公開エピソード」の正本
  id, episode_id, revision_id
  feed_snapshot_id, published_at
  -- 将来: withdrawn 用に EpisodeUnpublished を別イベントで
```

**下書き HEAD** = その `episode_id` の **`MAX(revision_no)`**（または `ORDER BY revision_no DESC LIMIT 1`）。`head_revision_id` 列は不要。

**公開エピソード** = その `episode_id` の **最新 `episode_publications` 行**（`published_at` 最大）。未公開 = publication 行が 0 件。

```sql
-- 公開中の中身（read model）
SELECT r.*
FROM episode_publications p
JOIN episode_revisions r ON r.id = p.revision_id
WHERE p.episode_id = $1
ORDER BY p.published_at DESC
LIMIT 1;
```

RSS / Web の「配信に出す版」は **必ずこの join** から取る。`episodes.published_at` や `status = published` は廃止。

### EpisodePublished が担うこと（旧 Cursor / status の置き換え）

| 旧 | 新 |
|----|-----|
| `listed_revision_id` UPDATE | `INSERT episode_publications (revision_id, …)` |
| `publication_phase = listed` | publication が 1 件以上存在 |
| `updateRss` 成功で `status = published` | **`PublishEpisode` ユースケース** が publication + FeedSnapshot を INSERT |
| 音声再生成後の再公開 | 新 Revision → 新 **EpisodePublished**（同一 episode id、guid 不変） |
| 画像だけ変えて feed 反映 | 新 Revision（artwork）→ **EpisodePublished**（TUI の Ctrl+Y 相当） |

**ドメインイベント** `EpisodePublished` と **永続行** `episode_publications` は同じ出来事（イベントテーブルと publication テーブルを 1 つにしてもよい）。

### Cursor は本当に不要か

| 関心 | Cursor なしで足りるか |
|------|------------------------|
| 掲載中 revision | **足りる** — 最新 publication |
| 制作 HEAD revision | **足りる** — 最新 revision_no |
| 未公開か | **足りる** — publication 0 件 |
| `script_running` / `audio_downloading` 等 | **そのままでは弱い** — revision は「コミット済みスナップショット」だけ |

制作フェーズは次のいずれか。

1. **導出（推奨・Cursor 不要）**: 未完了 `craft_workflow_runs`、pending `tts_jobs`、failed 成果物の有無から TUI/CLI 用ビューを組む。
2. **縮退キャッシュ（任意）**: `episode_production_state(episode_id, phase)` の 1 列 UPDATE。Cursor より責務が狭く、Publication とは分離。

**結論**: **公開の意味での Cursor（listed / publication_phase）は `EpisodePublished` で削除できる。** 制作 UI 用 phase だけ、導出か最小キャッシュを選ぶ。

### リビジョンをいつ切るか

| トリガ | 新 `EpisodeRevision` | `cause` | 備考 |
|--------|----------------------|---------|------|
| ingest 直後 | 仮タイトル等 | `initial` | revision 0 |
| 台本 ready | title/description + script | `script_regenerated` | 音声・画像 id は前 revision からコピー可 |
| 音声 ready | episode_audio_id | `audio_regenerated` | |
| 画像 ready | episode_artwork_id | `artwork_regenerated` | 失敗時は revision なし |
| **公開** | （必ずしも新 revision 不要） | — | **既存 head revision を指す publication を INSERT**。内容変更後の公開は **先に revision → 後 publish** |

`RepublishFeed` は **同じ revision_id で publication を再度 INSERT する**（feed だけ壊れた）か、**FeedSnapshot だけ**足す設計も可。意味的には「再掲」も Publish の一種。

### 読み取りモデル

| 用途 | 参照 |
|------|------|
| TUI「制作中の最新」 | `episode_revisions` WHERE episode_id ORDER BY revision_no DESC LIMIT 1 |
| Web / プレイヤー / RSS item | **最新 `episode_publications`** → revision → Audio / Artwork |
| 公開履歴 | 全 `episode_publications` |
| guid | 常に `episodes.id` |

### 現行 `episodes` からの移行イメージ

1. `episodes` を identity のみに。
2. 現行 1 行 → `episode_revisions` revision 1。
3. `status IN (published, …)` かつ feed 載せ済み → `episode_publications` 1 行 backfill（revision 1 を指す）。
4. `UPDATE episodes SET status/title/...` を **CommitRevision** + **PublishEpisode** に置換。

### Job Execution 層との関係

- `RebuildFeed` ステップ成功 → **`PublishEpisode(episodeId, revisionId?, feedSnapshotId)`**（内部で publication INSERT）。
- WorkflowRun は EpisodeIdentity に紐づく。phase 用 Cursor は持たない。

---

## エンティティ分解（to-be）

### EpisodeIdentity（`episodes` — 不変）

| 属性 | 説明 |
|------|------|
| `id` | 不変。RSS guid |
| `article_id` | ingest スナップショット |
| `created_at` | 生成時刻 |

**ここに title / status / image / audio は置かない。**

### EpisodeRevision / EpisodePublished

- **Revision** — 制作の追記スナップショット。HEAD は `MAX(revision_no)` で決める。
- **Publication** — `EpisodePublished` イベント行。**公開エピソード = 最新 publication が指す revision**（Cursor 不要）。

### エンティティ: ScriptDraft（現 `scripts` の再定義）

台本 **1 回分の生成試行**。追記のみ。

| 属性 | 説明 |
|------|------|
| `episode_id` | 親 |
| `content` | Host/CoHost 台本 |
| `outcome` | `ready` / `failed` |
| `llm_usage`, `llm_response` | プロバイダメタ |
| `requested_by` | `ingest` / `manual` / `workflow_run_id` |

TTS は **head revision** が指す `script_draft_id`（または制作中の最新 ready 台本）を入力とする。

### エンティティ: EpisodeArtwork（新規 — 現 `image_url` の昇格）

画像は Episode の列ではなく **独立エンティティ**。

| 属性 | 説明 |
|------|------|
| `id`, `episode_id` | |
| `storage_path`, `mime_type` | Storage `podcast` バケット |
| `outcome` | `ready` / `failed` / `skipped` |
| `llm_usage`, `llm_response` | 画像 LLM |
| `created_at` | 試行履歴 |

再生成は Artwork 行を INSERT → 新 **EpisodeRevision** → 公開するなら **EpisodePublished** を INSERT。

### エンティティ: TtsJob（現 `audio_files` の pending 側を分離）

Gemini バッチ **ジョブ** 専用。完成 WAV とは別寿命。

| 属性 | 説明 |
|------|------|
| `id`, `episode_id`, `script_id` | 入力台本 |
| `batch_name` | 外部ジョブ ID（ユニーク） |
| `phase` | `submitted` / `running` / `succeeded` / `failed` / `cancelled` |
| `poll_state` | 最終 poll（現 `llm_response.batch` の正規化） |
| `tts_selection` | 声・トーン（JSON 可） |

download-monitor は **TtsJob** をスキャンし、完了時にドメインサービス `CompleteTtsJob` を呼ぶ（内部で EpisodeAudio 作成）。

### エンティティ: EpisodeAudio（現 `audio_files` の ready 側 + URL）

**配信可能な音声成果物**。公開 URL はここから導出する。

| 属性 | 説明 |
|------|------|
| `id`, `episode_id`, `script_id`, `tts_job_id` | 系譜 |
| `storage_path`, `mime_type` | 正本（現 `storage_path`） |
| `byte_size` | 任意 |
| `outcome` | `ready` / `failed` |

`public_url` は DB 列に持たず、`SUPABASE_URL + storage_path` で組み立てる。Web/RSS は **listed revision** が指す `episode_audio_id` を join。**`episodes.audio_url` は廃止**。

pending 中は EpisodeAudio 行が無く、TtsJob のみ存在する — ジョブと成果物の混線を解消。

### 集約 2: PodcastChannel（公開）

| エンティティ | 説明 |
|--------------|------|
| **FeedSnapshot** | `feed.xml` の世代 |
| **EpisodePublication** | 公開イベント（`episode_publications`）。revision + feed 世代を束ねる |

`updateRss` の成功 = **`PublishEpisode`**: FeedSnapshot INSERT + **対象 revision_id で episode_publications INSERT**。feed 組み立ては **各 episode の最新 publication** から item を生成。

### その他（変更なしに近い）

- **Article** — IngestSnapshot のまま
- **PodcastConfig** — 設定コンテキスト

---

## ER（目標・概念）

```mermaid
erDiagram
  ARTICLE ||--o{ EPISODE : feeds
  EPISODE ||--o{ EPISODE_REVISION : revisions
  EPISODE ||--o{ EPISODE_PUBLICATION : publishes
  EPISODE ||--o{ SCRIPT_DRAFT : attempts
  EPISODE ||--o{ EPISODE_ARTWORK : attempts
  EPISODE ||--o{ TTS_JOB : submits
  EPISODE ||--o{ EPISODE_AUDIO : artifacts
  EPISODE_REVISION }o--|| SCRIPT_DRAFT : may_reference
  EPISODE_REVISION }o--|| EPISODE_AUDIO : may_reference
  EPISODE_REVISION }o--|| EPISODE_ARTWORK : may_reference
  EPISODE_REVISION ||--o{ EPISODE_PUBLICATION : published_as
  SCRIPT_DRAFT ||--o{ TTS_JOB : input
  TTS_JOB ||--o| EPISODE_AUDIO : produces
  FEED_SNAPSHOT ||--o{ EPISODE_PUBLICATION : recorded_in
  PODCAST_CHANNEL ||--o{ FEED_SNAPSHOT : publishes

  EPISODE {
    uuid id
    timestamptz created_at
  }

  EPISODE_REVISION {
    uuid id
    int revision_no
    text title
    text cause
  }

  EPISODE_PUBLICATION {
    uuid id
    timestamptz published_at
    uuid revision_id
  }
```

---

## ドメインイベントの分解

3 種類を **別テーブル／別名前空間** で扱う。混ぜない。

### A. ドメインイベント（`craft_domain_events` 想定）

ビジネス上意味のある出来事。append-only。投影（read model）や Publication の更新トリガに使う。

| イベント型 | 発生タイミング | 主なペイロード |
|------------|----------------|----------------|
| `EpisodeCreated` | ingest | episode_id, article_id |
| `ScriptGenerationCompleted` | 台本 ready | script_draft_id, title, description |
| `ScriptGenerationFailed` | 台本 failed | error |
| `ArtworkGenerationCompleted` | 画像 ready | artwork_id, storage_path |
| `ArtworkGenerationFailed` | 画像 failed（非致命） | error |
| `TtsJobSubmitted` | batch 投入 | tts_job_id, batch_name |
| `TtsJobSucceeded` | batch 成功 | tts_job_id |
| `TtsJobFailed` | batch 失敗 | tts_job_id, error |
| `EpisodeAudioStored` | WAV upload 完了 | episode_audio_id, storage_path |
| `EpisodeListedInFeed` | RSS item に載った | feed_snapshot_id |
| `FeedRebuilt` | feed.xml 更新 | feed_snapshot_id, episode_count |

`scripts` / `episode_artworks` の行は **イベントの結果としての状態**であり、イベントそのものではない（二重記録を避けるなら、将来はイベントソーシング寄りにもできるが、第 1 段階は **イベント + 状態テーブル併存** で十分）。

### B. ワークフローステップ記録（`craft_step_runs` — Job Execution 層）

| 属性 | 説明 |
|------|------|
| `workflow_run_id` | 下記 |
| `step_key` | ドメイン定義: `GenerateScript`, `SubmitTts`, `FetchTtsOutput`, `GenerateArtwork`, `RebuildFeed` |
| `status` | pending / running / succeeded / failed / skipped |
| `external_ref` | pgflow task id など（任意） |

pgflow の `pgflow.runs` は **インフラの実行 ID**。ドメインは `craft_workflow_runs` を正とし、`pgflow_run_id` は Adapter が埋める。

### C. 運用テレメトリ（現 `processing_logs` の位置づけ）

ステージの duration・成功失敗ログ。**ドメインルールには使わない**。監査・TUI 用のまま維持。queue_name レガシーは徐々に `step_key` に寄せる。

---

## ジョブ実行レイヤー（Craft Job Execution）

### ドメイン側の型（TypeScript / 疑似）

```typescript
// ユースケースが pgflow を知らない
type ProductionIntent =
  | { kind: "StartFromIngest"; episodeId: string }
  | { kind: "RegenerateScript"; episodeId: string; refreshAudio: boolean; refreshArtwork: boolean }
  | { kind: "RegenerateAudio"; episodeId: string; republish: boolean }
  | { kind: "RegenerateArtwork"; episodeId: string; republish: boolean }
  | { kind: "RepublishFeed"; episodeId: string }
  | { kind: "PollPendingTts" }; // cron 用

interface JobExecutionService {
  enqueue(intent: ProductionIntent): Promise<CraftWorkflowRunId>;
}

interface WorkflowRunnerPort {
  start(run: CraftWorkflowRun): Promise<ExternalRunHandle>;
}
```

### テーブル（public スキーマ — 提案）

```sql
-- ドメインが所有する実行単位
create table craft_workflow_runs (
  id uuid primary key,
  episode_id uuid references episodes(id),
  intent jsonb not null,
  status text not null,
  pgflow_run_id uuid null,
  created_at timestamptz not null default now()
);

create table craft_step_runs (
  id uuid primary key,
  workflow_run_id uuid not null references craft_workflow_runs(id),
  step_key text not null,
  status text not null,
  started_at timestamptz,
  finished_at timestamptz,
  error text
);
```

### Adapter: PgflowWorkflowRunner

| ドメイン `step_key` | 現 pgflow step | 備考 |
|---------------------|----------------|------|
| `GenerateScript` | craftEpisodeSubmit.generateScript | |
| `SubmitTts` | generateAudioStart | |
| `GenerateArtwork` | generateEpisodeImage | |
| `FetchTtsOutput` | craftEpisodeDownload.generateAudioDownload | monitor が WorkflowRun を起動 |
| `RebuildFeed` | updateRss | |

**Intent → 実行計画** はドメインの `WorkflowPlanner` が決める（例: `RegenerateArtwork` + `republish: true` なら Artwork ステップの後に RebuildFeed を同じ WorkflowRun に含める）。pgflow の `startFrom` 行列は Adapter 内に閉じ込める。

### cron（download-monitor）の位置

to-be では monitor は pgflow を直接叩かず、

1. `PollPendingTts` intent で `JobExecutionService.enqueue`
2. Planner が `FetchTtsOutput`（必要なら `RebuildFeed`）をスケジュール
3. Adapter が pgflow Download フローを起動

Episode の `audio_downloading` ロックは **TtsJob** または **WorkflowRun** の排他に移す。

---

## ユースケース → 触るエンティティ（to-be）

| 命令 | 主に更新 | 発行イベント（例） |
|------|----------|-------------------|
| StartFromIngest | EpisodeIdentity, Revision 0, Cursor, ScriptDraft, … | EpisodeCreated |
| RegenerateScriptOnly | ScriptDraft + **新 Revision**（audio/art  id 継承） | ScriptGenerationCompleted |
| RegenerateAudio | TtsJob → EpisodeAudio + **新 Revision** | EpisodeAudioStored |
| RegenerateArtwork | Artwork + **新 Revision** | ArtworkGenerationCompleted |
| RepublishFeed | listed_revision 更新, FeedSnapshot, EpisodeRelease | FeedRebuilt |

---

## 移行フェーズ（推奨）

0. **Phase 0 — Identity + Revision**: `episode_revisions` / `episode_cursors` 導入。`episodes` への title/status UPDATE を廃止し backfill。
1. **Phase A — 成果物テーブル**: `episode_artworks` / `episode_audios`、`image_url` / ready な `audio_files` を移行。
2. **Phase B — TtsJob 分離**: pending を `tts_jobs` へ。
3. **Phase C — Job Execution**: `craft_workflow_runs`、pgflow Adapter。
4. **Phase D — ドメインイベント + episode_releases**。

各 Phase は独立 PR にし、**既存 migration は編集しない**（リポジトリ規約どおり新規 migration のみ）。

---

## 参照

- 現状 UC・CLI: [podcast-craft-domain.md](./podcast-craft-domain.md)
- ステージ実装: [pipeline-stages.ts](../../supabase/functions/_shared/pipeline-stages.ts)
- pgflow Worker: [craft-episode-worker/index.ts](../../supabase/functions/craft-episode-worker/index.ts)
