# ポッドキャスト制作のドメインモデル（ToBe 案）

ポッドキャスト制作（ingest → 台本 → 音声・アートワーク → 公開 → RSS）を DDD で組み直すための ToBe 案である。粗い初案をレビューし、次の 4 層に分ける。

1. ドメイン層（制作の事実と規則）
2. 抽象ジョブ実行層（LLM 呼び出しを含む、非同期ジョブの記録と再試行）
3. ジョブ基盤アダプタ層（pgflow・Gemini・Storage への変換）
4. インフラ層（pgflow / pgmq / Postgres、Gemini API、Supabase Storage、Edge Runtime）

---

## 1. レイヤー構成

```mermaid
flowchart TB
  subgraph D["ドメイン層"]
    direction LR
    AGG["集約<br/>Article / Episode / Production / Script / Audio / Artwork / Show"]
    PM["ProductionPolicy<br/>（プロセスマネージャ）"]
    EV["ドメインイベント"]
  end
  subgraph J["抽象ジョブ実行層"]
    direction LR
    JOB["Job / JobAttempt"]
    LLM["LlmInvocation / PromptTemplate"]
    EXT["ExternalOperation"]
    BLOB["Blob"]
  end
  subgraph A["アダプタ層"]
    direction LR
    PGA["pgflow アダプタ"]
    GEM["Gemini アダプタ"]
    STA["Storage アダプタ"]
    POL["外部処理ポーラー（cron）"]
  end
  subgraph I["インフラ層"]
    direction LR
    PGF["pgflow / pgmq / Postgres"]
    GAPI["Gemini API"]
    SST["Supabase Storage"]
  end
  PM -- "JobRequester ポート" --> JOB
  JOB -- "JobOutcome（翻訳して ScriptWritten 等へ）" --> PM
  JOB -- "JobBackend ポート" --> PGA
  LLM -- "LlmGateway ポート" --> GEM
  BLOB -- "BlobStore ポート" --> STA
  POL --> EXT
  PGA --> PGF
  GEM --> GAPI
  STA --> SST
```

依存の向きは上から下だけにする。各層の責務と、知ってはいけないものを次に示す。

| 層 | 責務 | 知ってはいけないもの |
|----|------|----------------------|
| ドメイン | 何を作るか、何が揃えば次へ進むか、何を公開するか | 再試行回数、モデル名、pgflow の run・step |
| 抽象ジョブ実行 | ジョブの依頼・試行・失敗分類・外部待ち・LLM 呼び出し記録・成果物 | エピソードの状態遷移、pgflow のテーブル |
| アダプタ | Job を pgflow の run / task に、LlmGateway を Gemini SDK に変換する | 集約の不変条件 |
| インフラ | キュー、ワーカー、API、オブジェクト保存 | 上の層すべて |

境界をまたぐ参照は 3 本に限る。

- `Job.correlation_id` → `Production.id`（どの制作のジョブか）
- `Job.requested_by_event_id` → ドメインイベント（何がきっかけか）
- `Script.produced_by_job_id` など → `Job.id`（どのジョブが作ったか）

ドメインは `JobAttempt` や `LlmInvocation` を読まない。TUI やコスト集計のような運用ビューだけが、この 3 本を辿って両層を結合する。

---

## 2. 初案のレビュー

### 2.1 全体の指摘

**FK を持つ側が多側（または 1:1 の従側）になる。** 初案は「イベントがエンティティを作る」向きで線を引いているため、FK の向きとカーディナリティが逆になっている箇所が多い。Mermaid の `A ||--o{ B` は「A 1 件に B が 0..n 件」であり、FK は B が持つ。

**`previous` はエンティティ間の関係ではない。** イベント同士の因果関係なので、ER ではなくイベントの封筒（envelope）に `causation_id`（直前のイベント）と `correlation_id`（同じ制作に属するイベントの束）を持たせる。流れは ER とは別の図（§3.3）で表す。合流（音声とアートワークの両方を待つ）は FK では表せないので、プロセスマネージャの規則として書く。

**`*CreateStarted` の多くはジョブ実行層の事実である。** 「台本生成を開始した」「失敗して再試行した」はドメインの事実ではない。ドメインに残すのは「制作を依頼した（`ProductionRequested`）」だけにし、各工程の開始・試行・失敗は `Job` / `JobAttempt` に移す。`EpisodeCreateStarted.workflow_run_id` は pgflow の識別子がドメインに漏れているので、アダプタ層の対応表に移す。

### 2.2 関係ごとの指摘

| 初案の関係 | 問題 | ToBe |
|------------|------|------|
| `ArticleRegistered \|\|--o{ Article : registers` | FK はイベント側にある。同じ記事は再 ingest で何度も登録される | `Article \|\|--o{ ArticleRegistered`。本文の変化は `ArticleRevision`（`content_sha`）で表す |
| `ArticleRegistered \|\|--o{ EpisodeCreateStarted : previous` | `EpisodeCreateStarted` に FK がない。手動の再生成は記事登録なしで始まる | `ProductionRequested.causation_id`（任意）。依頼の入力は `article_revision_id` で持つ |
| `ScriptCreateStarted \|\|--o{ ScriptCreated` ほか `*Started → *Created` | 1 回の開始に成功は高々 1 件。再試行の多重度はジョブ層の話 | ジョブ層で `Job \|\|--o{ JobAttempt`、ドメインは `Production \|\|--o\| Script` |
| `AudioCreated`・`EpisodeCreated` | 開始イベントや合流元への FK がない | 封筒の `causation_id`。合流は ProductionPolicy の規則 |
| `EpisodeCreateStarted \|\|--o{ ArtworkCreateStarted` | 現行のアートワーク生成は Script の title・description を入力にする。`ArtworkCreateStarted.script_id` とも食い違う | `Script \|\|--o{ Artwork`。台本の後に分岐する |
| `Artwork.input_article_id` | 上と同じ理由で入力が違う | `Artwork.script_id` |
| `Script.outcome` | 失敗した Script は台本ではない | Script は成功時だけ作る。失敗は `JobAttempt` |
| `EpisodeCreated \|\|--o{ Episode : creates` | FK はイベント側にあり 1:1 | `Episode` 側から見て 1:1。ToBe では `EpisodeRevision` を作るイベントになる |
| `Article \|\|--\|\| Episode : generates` | 再生成で Episode を作り直すと RSS の GUID が変わり、購読アプリで別エピソード扱いになる | 安定した `Episode`（GUID を持つ）と、構成を差し替える `EpisodeRevision` に分ける。`Article \|\|--o\| Episode` |
| `Episode \|\|--\|\| Script/Audio/Artwork : contains` | FK は Episode 側。音声だけ作り直すと同じ Script が複数の版で使われる。アートワークは無効化できる | `Script \|\|--o{ EpisodeRevision`、`Audio \|\|--o{ EpisodeRevision`、`Artwork \|o--o{ EpisodeRevision` |
| `EpisodePublished \|\|--o{ EpisodePublication : projects` | 1:1 の射影 | `EpisodeRevision \|\|--o{ EpisodePublication`。取り下げ・再公開の履歴を持つ |
| `EpisodePublication \|\|--\|\| Episode : publishs` | 公開されるのは版。綴りも誤り | `EpisodePublication.episode_revision_id` |
| `EpisodePublished \|\|--o{ FeedRebuilt` | 1 回の再構築は複数の公開・取り下げ・番組情報の変更をまとめて反映する | `FeedRebuilt` は `Show` 単位。きっかけは `causation_id`、中身は `FeedItem` |
| `FeedEpisode }\|--\|{ FeedSnapshot / Episode` | 関連エンティティ自身に多対多は付かない | `FeedSnapshot \|\|--\|{ FeedItem`、`EpisodeRevision \|\|--o{ FeedItem`。並び順と GUID・pubDate を持つ |

### 2.3 足りない属性

| 属性 | 理由 |
|------|------|
| `Episode.guid` | RSS の同一性。現行は `episodes.id` を流用している |
| `EpisodeRevision.title / description` | 現行は台本生成が `episodes` に書き込んでいる。版ごとに持つ |
| `Audio.duration_ms`、`Blob.byte_size` | `itunes:duration` と enclosure の `length`。現行は length が 0 固定 |
| `Audio.casting` | `tts.selection_mode = random` で選ばれた声とトーン。再現と比較に要る |
| `Production.profile` | 制作時点の設定（モデル、プロンプトの版、チャンク長）のスナップショット。`podcast_config` は後から変わる |
| 封筒の `actor` | ingest 以外（手動再生成、管理画面）も誰が依頼したかを残す |

---

## 3. ドメイン層

### 3.1 集約

| 集約 | ルート | 役割 |
|------|--------|------|
| Article | `Article` + `ArticleRevision` | Git 上の記事（`content_path`）と、その本文の版（`content_sha`） |
| Show | `Show` | 番組。タイトル・説明・カバー。`podcast_config` の `podcast.*` を移す |
| Episode | `Episode` + `EpisodeRevision` + `EpisodePublication` | 購読者から見た 1 話。GUID は不変、中身は版で差し替える |
| Production | `Production` | 1 回の制作依頼。範囲（全部・音声だけ・画像だけ）と設定スナップショットを持つ。ジョブの `correlation_id` |
| Script / Audio / Artwork | 各ルート | 生成物。作成後は変更しない |
| Feed | `FeedSnapshot` + `FeedItem` | ある時点の RSS の中身 |

Script・Audio・Artwork は不変の生成物なので、それぞれ小さな集約にする。Episode 集約に含めると、音声だけの再生成でも Episode 全体をロックすることになる。

### 3.2 ER 図

```mermaid
erDiagram
  Show {
    uuid id PK
    text title
    text description
    uuid cover_blob_id FK
  }
  Article {
    uuid id PK
    text content_path UK
    text mem_note_id
    timestamptz created_at
  }
  ArticleRevision {
    uuid id PK
    uuid article_id FK
    text content_sha
    text title
    timestamptz registered_at
  }
  Episode {
    uuid id PK
    uuid show_id FK
    uuid article_id FK
    text guid UK
    timestamptz created_at
  }
  Production {
    uuid id PK
    uuid episode_id FK
    uuid article_revision_id FK
    uuid base_revision_id FK "再生成で流用する版"
    text scope "full | audio | artwork | republish"
    text trigger "ingest | manual"
    jsonb profile "設定スナップショット"
    timestamptz requested_at
  }
  Script {
    uuid id PK
    uuid article_revision_id FK
    uuid production_id FK
    uuid produced_by_job_id FK
    text title
    text description
    text content
    timestamptz created_at
  }
  Audio {
    uuid id PK
    uuid script_id FK
    uuid production_id FK
    uuid produced_by_job_id FK
    uuid blob_id FK
    int duration_ms
    jsonb casting "host / cohost の声とトーン"
    timestamptz created_at
  }
  Artwork {
    uuid id PK
    uuid script_id FK
    uuid production_id FK
    uuid produced_by_job_id FK
    uuid blob_id FK
    timestamptz created_at
  }
  EpisodeRevision {
    uuid id PK
    uuid episode_id FK
    uuid production_id FK
    uuid script_id FK
    uuid audio_id FK
    uuid artwork_id FK "null 可"
    text title
    text description
    timestamptz assembled_at
  }
  EpisodePublication {
    uuid id PK
    uuid episode_revision_id FK
    timestamptz published_at
    timestamptz withdrawn_at
  }
  FeedSnapshot {
    uuid id PK
    uuid show_id FK
    uuid produced_by_job_id FK
    uuid blob_id FK
    int item_count
    timestamptz built_at
  }
  FeedItem {
    uuid feed_snapshot_id PK, FK
    int position PK
    uuid episode_revision_id FK
    text guid
    timestamptz pub_date
  }

  Show ||--o{ Episode : airs
  Show ||--o{ FeedSnapshot : "is syndicated as"
  Article ||--|{ ArticleRevision : "has"
  Article ||--o| Episode : "is adapted into"
  ArticleRevision ||--o{ Production : "is input of"
  Episode ||--o{ Production : "is produced by"
  ArticleRevision ||--o{ Script : "is source of"
  Production ||--o| Script : writes
  Production ||--o| Audio : renders
  Production ||--o| Artwork : paints
  Script ||--o{ Audio : "is voiced as"
  Script ||--o{ Artwork : "is illustrated as"
  Episode ||--o{ EpisodeRevision : "has"
  Production ||--o| EpisodeRevision : assembles
  Script ||--o{ EpisodeRevision : "is used in"
  Audio ||--o{ EpisodeRevision : "is used in"
  Artwork |o--o{ EpisodeRevision : "is used in"
  EpisodeRevision ||--o{ EpisodePublication : "is published as"
  FeedSnapshot ||--|{ FeedItem : lists
  EpisodeRevision ||--o{ FeedItem : "appears as"
```

関係名は「左 → 右」に能動態で読める動詞にそろえた（例: Production writes Script）。

不変条件は次のとおりである。

- `EpisodeRevision.audio_id` の Audio と `artwork_id` の Artwork は、同じ `script_id` から作られている。
- 1 つの Episode で、公開中（`withdrawn_at is null`）の `EpisodePublication` は高々 1 件である。
- `Production.scope = audio` のとき、Script は `base_revision_id` の版から流用し、新しく作らない。

### 3.3 ドメインイベント

イベントは種類ごとのテーブルではなく、共通の封筒を持つ 1 本の追記専用テーブルに入れる。種類ごとの差は `payload` に置く。

| 封筒の列 | 意味 |
|----------|------|
| `id` | イベント ID |
| `type` | 下表のイベント名 |
| `stream_type` / `stream_id` | 対象集約（例: `production` / Production の ID） |
| `occurred_at` | 発生時刻 |
| `actor` | `ingest`、`manual:<user>`、`system` など |
| `correlation_id` | Production の ID。記事登録だけは null |
| `causation_id` | 直前のイベント。初案の `previous` はここに入る |
| `payload` | 種類ごとの属性 |

| イベント | payload | 初案との対応 |
|----------|---------|--------------|
| `ArticleRegistered` | `article_id`、`article_revision_id`、`ingest_route` | 同名 |
| `ProductionRequested` | `production_id`、`episode_id`、`scope`、`trigger` | `EpisodeCreateStarted` |
| `ScriptWritten` | `script_id`、`job_id` | `ScriptCreated` |
| `AudioRendered` | `audio_id`、`job_id` | `AudioCreated` |
| `ArtworkPainted` | `artwork_id`、`job_id` | `ArtworkCreated` |
| `EpisodeAssembled` | `episode_revision_id` | `EpisodeCreated` |
| `EpisodePublished` | `publication_id`、`episode_revision_id` | 同名 |
| `EpisodeWithdrawn` | `publication_id`、`reason` | 新規 |
| `FeedRebuilt` | `feed_snapshot_id`、`item_count` | 同名 |
| `ProductionFailed` | `production_id`、`failed_job_id`、`reason` | 新規 |

`ScriptCreateStarted`・`AudioCreateStarted`・`ArtworkCreateStarted` はドメインイベントにしない。ジョブ層の `Job`（依頼）と `JobAttempt`（試行）がその役目を担う。

正常系の因果は次のようになる。

```mermaid
flowchart LR
  AR[ArticleRegistered] --> PR[ProductionRequested]
  PR -. "Job: write_script" .-> SW[ScriptWritten]
  SW -. "Job: render_audio" .-> AuR[AudioRendered]
  SW -. "Job: paint_artwork" .-> ArP[ArtworkPainted]
  AuR --> EA[EpisodeAssembled]
  ArP --> EA
  EA --> EP[EpisodePublished]
  EP -. "Job: rebuild_feed" .-> FR[FeedRebuilt]
  PR -. "Job が最終的に失敗" .-> PF[ProductionFailed]
```

点線はジョブ層を経由する区間、実線はドメイン内で同期的に決まる区間である。

### 3.4 ProductionPolicy（プロセスマネージャ）

工程の順序と合流はドメインの規則として持つ。現行の `startFrom` による step のスキップは、この規則が pgflow の DAG に入り込んでいるために生じている。

| 受け取るもの | 条件 | 行うこと |
|--------------|------|----------|
| `ProductionRequested` | `scope = full` | `write_script` を依頼 |
| `ProductionRequested` | `scope = audio` | 流用する Script で `render_audio` を依頼 |
| `ProductionRequested` | `scope = artwork` | 流用する Script で `paint_artwork` を依頼 |
| `ScriptWritten` | — | `render_audio` を依頼。`profile.artwork.enabled` なら `paint_artwork` も依頼 |
| `AudioRendered` / `ArtworkPainted` | 必要な生成物が揃った。足りない側は `base_revision_id` から流用 | `EpisodeRevision` を組み立て、`EpisodeAssembled` |
| `EpisodeAssembled` | 公開方針が自動 | 旧版の公開を閉じ、`EpisodePublished` |
| `EpisodePublished` / `EpisodeWithdrawn` | — | Show 単位で `rebuild_feed` を依頼（重複依頼はまとめる） |
| `JobFailed`（再試行の上限に達した） | — | `ProductionFailed` |

`episodes.status`（`script_running` など）は、イベントとジョブの状態から作る読み取りモデルにする。書き込み側の状態としては持たない。

---

## 4. 抽象ジョブ実行層

### 4.1 概念

| 概念 | 意味 |
|------|------|
| `JobType` | ジョブの種類。実行方式（`llm_sync`・`llm_batch`・`compute`）、入出力スキーマ、再試行方針、タイムアウトを宣言する |
| `Job` | ドメインからの 1 件の依頼。冪等キーを持ち、成功すれば出力（生成物への参照）を返す |
| `JobAttempt` | 1 回の実行。失敗は `retryable`・`terminal`・`rate_limited` に分類する |
| `ExternalOperation` | 外部で長時間走る処理（Gemini Batch）。待っている間はジョブを `waiting_external` にし、試行回数を消費しない |
| `LlmInvocation` | LLM への 1 リクエスト。モデル、プロンプトの版、パラメータ、トークン使用量、レイテンシ、終了理由。Batch の各チャンクも 1 件ずつ記録する |
| `PromptTemplate` | 版付きのプロンプト。台本・TTS 指示・画像プロンプト |
| `Blob` | 生成されたバイト列（音声・画像・feed.xml・LLM の生レスポンス）。ドメインからも参照する共有カーネル |

ジョブ層の `JobType` は次の 4 種から始める。

| JobType | 実行方式 | 入力 | 出力 |
|---------|----------|------|------|
| `write_script` | `llm_sync` | `article_revision_id`、profile | 台本・title・description |
| `render_audio` | `llm_batch` | `script_id`、profile | 音声 Blob、duration、casting |
| `paint_artwork` | `llm_sync` | `script_id`、profile | 画像 Blob |
| `rebuild_feed` | `compute` | `show_id` | feed.xml Blob、FeedItem の一覧 |

ジョブ層は「台本」や「エピソード」を知らない。出力は JSON と Blob 参照であり、ドメイン側の翻訳器（Anti-Corruption Layer）が `Script` 行と `ScriptWritten` に変換する。

### 4.2 ER 図

```mermaid
erDiagram
  JobType {
    text name PK
    text executor_kind "llm_sync | llm_batch | compute"
    jsonb input_schema
    jsonb output_schema
    jsonb retry_policy
    int timeout_seconds
  }
  Job {
    uuid id PK
    text job_type FK
    uuid correlation_id "Production.id"
    uuid requested_by_event_id
    text idempotency_key UK
    jsonb input
    text status "requested | running | waiting_external | succeeded | failed | cancelled"
    jsonb output
    timestamptz requested_at
    timestamptz finished_at
  }
  JobAttempt {
    uuid id PK
    uuid job_id FK
    int attempt_no
    text outcome "succeeded | retryable | terminal | rate_limited"
    text error_message
    timestamptz started_at
    timestamptz finished_at
  }
  ExternalOperation {
    uuid id PK
    uuid attempt_id FK
    text provider
    text operation_name "Gemini batch job name"
    text state
    int poll_count
    timestamptz submitted_at
    timestamptz next_poll_at
  }
  PromptTemplate {
    uuid id PK
    text name
    int version
    text system_instruction
    text template
  }
  LlmInvocation {
    uuid id PK
    uuid attempt_id FK
    uuid external_operation_id FK "Batch のときだけ"
    int item_index
    uuid prompt_template_id FK
    text provider
    text model
    jsonb params
    uuid request_blob_id FK
    uuid response_blob_id FK
    int input_tokens
    int output_tokens
    int latency_ms
    text finish_reason
  }
  Blob {
    uuid id PK
    text storage_path
    text mime_type
    bigint byte_size
    text sha256
    uuid produced_by_attempt_id FK
  }

  JobType ||--o{ Job : classifies
  Job ||--o{ JobAttempt : "is tried by"
  JobAttempt ||--o| ExternalOperation : submits
  JobAttempt ||--o{ LlmInvocation : issues
  ExternalOperation |o--o{ LlmInvocation : batches
  PromptTemplate ||--o{ LlmInvocation : "is rendered into"
  JobAttempt ||--o{ Blob : produces
```

ジョブの状態遷移は次のとおりである。

```mermaid
stateDiagram-v2
  [*] --> requested
  requested --> running : アダプタが試行を開始
  running --> waiting_external : ExternalOperation を投入
  waiting_external --> running : ポーラーが完了を検知
  running --> succeeded
  running --> requested : retryable / rate_limited（上限内）
  running --> failed : terminal または上限超過
  requested --> cancelled
  waiting_external --> cancelled
  succeeded --> [*]
  failed --> [*]
  cancelled --> [*]
```

`waiting_external` を独立した状態にすると、現行の `craftEpisodeSubmit` → download-monitor → `craftEpisodeDownload` という 2 本のフローへの分割が不要になる。ポーラーは pgflow の外で `ExternalOperation.next_poll_at` を見て、完了したジョブだけを `running` に戻す。

冪等キーは `job_type`・入力の参照 ID・profile のハッシュから作る。pgflow が同じ step を再実行しても、同じキーの Batch が投入済みならそれを再利用する。現行の `pendingAudio` の再利用をジョブ層の一般規則にしたものである。

### 4.3 ドメインとの接続

```mermaid
erDiagram
  Production ||--o{ Job : correlates
  Job ||--o| Script : yields
  Job ||--o| Audio : yields
  Job ||--o| Artwork : yields
  Job ||--o| FeedSnapshot : yields
  Blob ||--o| Audio : stores
  Blob ||--o| Artwork : stores
  Blob ||--o| FeedSnapshot : stores
```

ポートは次の 4 つにする。

| ポート | 定義する層 | 実装する層 | 操作 |
|--------|------------|------------|------|
| `JobRequester` | ドメイン | ジョブ層 | `request(jobType, input, correlationId, causationEventId)` |
| `JobOutcomeHandler` | ドメイン | ドメイン（翻訳器） | `onSucceeded(job)`、`onFailed(job)` |
| `JobBackend` | ジョブ層 | アダプタ（pgflow） | `dispatch(job)`、`cancel(job)` |
| `LlmGateway` | ジョブ層 | アダプタ（Gemini） | `generate`、`submitBatch`、`pollBatch`、`fetchBatchResults` |

`BlobStore`（`put` / `get`）もジョブ層で定義し、Storage アダプタが実装する。

---

## 5. アダプタ層とインフラ層

pgflow アダプタは `Job` 1 件を pgflow の run 1 件に対応させる。フローは汎用の 1 ステップ（入力 `{ jobId }`）にし、ステップの中でジョブ層の `JobRunner.runAttempt(jobId)` を呼ぶ。pgflow の再試行は使わず（`maxAttempts: 1`）、再試行の判断は `JobType.retry_policy` に寄せる。pgflow の識別子はアダプタ専用の表に閉じ込める。

| 列 | 意味 |
|----|------|
| `job_id` | ジョブ層の Job |
| `attempt_id` | ジョブ層の JobAttempt |
| `flow_slug` / `run_id` / `step_slug` / `task_index` | pgflow 側の識別子 |

この形にすると、pgflow を pgmq 直結や別のジョブ基盤に替えても、ドメイン層とジョブ層は変わらない。

一方で、工程の DAG が pgflow のフロー定義から消え、pgflow の画面で制作全体の流れを追えなくなる。追跡はドメインイベントの `correlation_id` で行う。DAG を pgflow に残す案（ジョブ層に `Workflow` を置き、アダプタがフロー定義にコンパイルする）も取れる。ただし、部分的な再生成や合流の条件がフロー定義側に残り、現行の `startFrom` 分岐と同じ問題が戻るので、本案では採らない。

Gemini アダプタは `LlmGateway` を実装する。チャンク分割した TTS の Batch 投入、ポーリング、WAV の取得と結合はここに置き、モデル名やエンドポイント（`gemini.api_root`）の解決もここで閉じる。

---

## 6. その他の提案

| 要素 | 内容 | 理由 |
|------|------|------|
| Show 集約 | `podcast.title` などを `podcast_config` から移す | フィードが Show に属する。将来の複数番組にも対応できる |
| Production の profile | 制作時点の設定を JSON で凍結する | 後から設定を変えても、どの設定で作ったかを再現できる |
| PromptTemplate の版管理 | 台本・TTS 指示・画像プロンプトを版付きで保存する | 品質の比較と差し戻しができる |
| 公開方針 | `auto` / `manual` を Show に持つ | 人が確認してから公開する運用を足せる |
| EpisodeWithdrawn | 公開の取り下げ | 誤った回を RSS から消せる。FeedItem の再計算のきっかけになる |
| コスト集計 | `LlmInvocation` のトークン数を Production 単位で集計する読み取りモデル | 再生成のコストが見える |
| 読み取りモデル | エピソード一覧・制作状況を、イベントとジョブ状態から射影する | TUI / CLI は射影だけを読む |

---

## 7. 未決事項

- `Article` と `Episode` を 1:0..1 に固定するか。同じ記事から別の切り口の回を作るなら 1:n にする。
- `rebuild_feed` をジョブにするか、公開と同じトランザクションで同期的に作るか。数秒で終わるなら同期でもよいが、Storage への書き込み失敗を再試行したいならジョブにする。
- イベント保存を正本（イベントソーシング）にするか、状態テーブルを正本にしてイベントを監査ログとして残すか。本案のエンティティは作成後に変更しないので、どちらでも成り立つ。
- 長い台本で TTS のチャンクが多いとき、チャンクごとに Job を分ける（map）か、1 Job の中の `LlmInvocation` 群にとどめるか。部分的な再生成が要るなら前者にする。
