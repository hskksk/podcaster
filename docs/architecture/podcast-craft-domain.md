# ポッドキャスト制作ドメイン（現状整理とリモデリングメモ）

対象範囲は、`POST /ingest` から台本・TTS・アートワーク・RSS（`feed.xml`）までの Supabase パイプライン。Git PKM の ingest 契約は [pkm-next.md](./pkm-next.md) を参照し、本稿は **craft** 境界コンテキストのみを扱う。

## 境界コンテキスト

| コンテキスト | 責務 | 主な成果物 |
|--------------|------|------------|
| **知識 ingest** | wiki/clip 本文を `articles` にスナップショット | `content_path`、`content_sha`、本文 |
| **エピソード制作** | 台本・TTS ジョブ・アートワークの生成、`episodes.status` による粗い進行管理 | `scripts`、`audio_files`、Storage 上の WAV/cover |
| **公開** | チャンネル RSS とリスナー向け URL | `feed.xml`、`published_at`、enclosure / itunes:image |
| **オーケストレーション** | ステージ実行とリトライ | pgflow の `craftEpisodeSubmit` / `craftEpisodeDownload`、cron の download-monitor |
| **運用** | 人手による再実行と可観測性 | CLI/TUI、`processing_logs` |

リスナーから見ると制作と公開は別関心だが、現行実装ではどちらも `episodes` を更新し、**1 つの status 列挙**を共有している。

## コアエンティティ（永続化）

- **Article** — ingest 時点の不変スナップショット。Git との対応は `content_path` / `content_sha`（任意）。
- **Episode** — 1 本のポッドキャスト項目。制作・公開の両方に関わる表示項目（`title`、`description`、`image_url`、レガシーの `audio_url`）とパイプライン状態を保持。
- **Script** — 台本生成の試行履歴（`ready` / `failed`）。TTS は `created_at` が最新の `ready` を参照。
- **AudioFile** — 行の追加または pending 行の更新。Gemini バッチは `batch_name` / `llm_response`、完成音声は `storage_path`。
- **PodcastConfig** — エピソード単位ではない実行時設定（キー・値）。

## ユースケース（現状 as-is）

自動の主経路: **UC-01 記事 ingest** → `craftEpisodeSubmit`（台本 → 音声開始 ∥ 画像）→ monitor → **UC-04 音声ダウンロード** → **UC-06 RSS 更新**。

### 再実行・再生成（手動）

| ID | 意図 | 入口 | フロー入力 | 実行されるステップ | RSS / feed |
|----|------|------|------------|-------------------|------------|
| UC-R-S | 台本ステージの再開 | `pnpm cli requeue script`、TUI Ctrl+S | `startFrom: script` | 台本（常に新規 LLM 行）、音声開始（no-op あり）、画像（`image_url` ありならスキップ） | 下流が download + updateRss まで完了した場合のみ |
| UC-R-S+ | 台本の作り直しと下流更新 | `regenerate-script`、TUI Ctrl+G | `script` + `regenerate: true` | 台本、音声開始（**新 batch**）、画像（**regenerate**） | Download フロー完了後 |
| UC-R-A | 音声開始の再開 | `requeue audio`、TUI Ctrl+A | `startFrom: audio` | 音声開始のみ。pending batch があれば実質スキップ | なし |
| UC-R-A+ | 音声の作り直しと再公開 | `regenerate-audio`、TUI Ctrl+R | `audio` + `regenerate: true` | 新 batch → monitor → download → updateRss | updateRss により **自動** |
| UC-R-I | アートワークのみ再生成 | `regenerate-image`、TUI Ctrl+I | `startFrom: image` | 画像のみ（失敗は非致命） | **自動ではない** — TUI は RSS（Ctrl+Y）を促す |
| UC-R-RSS | feed のみ再公開 | `requeue rss`、TUI Ctrl+Y | Download フロー `startFrom: rss` | updateRss のみ | `feed.xml` を全件再生成 |

ステップのスキップは [craft-episode-submit.ts](../../supabase/flows/craft-episode-submit.ts) で実装する。`startFrom` が `audio` または `image` のとき台本をスキップ、`image` のとき音声開始をスキップ、`audio` のとき画像をスキップ。画像の `regenerate` は `startFrom === "image"` またはトップレベルの `regenerate === true` のとき真。

### 公開済みエピソード

- **音声の再生成**: `startGeneratingAudio` は `published` から claim 可能。`audio_running` → … → `audio_ready` → `updateRss` → `published`（成功時に `published_at` を再設定）。
- **画像のみ**: DB と Storage は更新するが、**UC-R-RSS まで `feed.xml` は変わらない**。

## 目標ユースケース（to-be・リモデリング向け）

ユーザー意図はアプリケーション命令として表し、公開 API に `startFrom × regenerate` をそのまま出さない。

| to-be 命令 | ユーザーの目的 | 想定する連鎖 |
|------------|----------------|--------------|
| `StartEpisodeProduction` | ingest からの初回制作 | 台本 → 音声ジョブ → アートワーク（現行 ingest と同型） |
| `RegenerateScriptOnly` | 台本だけ差し替え。音声・アートは明示しない限り維持 | **現行未実装** |
| `RegenerateScriptAndRefreshAudio` | 新台本 + 新 TTS + 必要ならアート | 現行 `regenerate-script` に相当 |
| `RegenerateAudioAndRepublish` | 新 WAV + RSS | 現行 `regenerate-audio` + 暗黙の Download |
| `ResumePendingAudioJob` | 重複 batch を出さない | 現行 `requeue audio` に相当 |
| `RegenerateArtwork` | cover のみ | 現行 `regenerate-image` に相当 |
| `RegenerateArtworkAndRepublish` | cover + RSS の itunes:image | **未実装**（現状はアート後に RSS を手動） |
| `RepublishPodcastFeed` | `feed.xml` の再構築 | 現行 `requeue rss` に相当 |

## 集約境界（提案）

```text
┌─────────────────────┐     ┌──────────────────────────┐
│ IngestSnapshot      │     │ EpisodeProduction        │
│ (Article)           │────▶│ 根: Episode              │
│ 本文、Git 参照      │ 1:N │ Script*、AudioFile*      │
└─────────────────────┘     │ GeminiBatchJob（Audio 内）│
                            │ status: 台本/音声フェーズ  │
                            └────────────┬───────────────┘
                                         │ 公開
                                         ▼
                            ┌──────────────────────────┐
                            │ PodcastPublication       │
                            │ 根: PodcastChannel       │
                            │ feed スナップショット    │
                            │ EpisodePublication 断片  │
                            └──────────────────────────┘
```

- **EpisodeProduction** — 追記型の **Script** / **AudioFile** と粗い進行（`script_running`、`audio_running` など）を所有。
- **PodcastPublication** — RSS に載せる項目集合として **feed.xml** をチャンネル集約とみなし、各 item は制作成果（`storage_path`、`image_url`、タイトル、説明、guid = episode id）を参照。

現行の `updateRss` は複数エピソードを読んで 1 ファイルを上書きする（チャンネル単位）一方、トリガーした 1 本を `published` にする。制作完了と公開が同じ処理に混在している。

## CLI / TUI 対応

| CLI | TUI（Episodes 詳細） | フロー |
|-----|----------------------|--------|
| `requeue script` | Ctrl+S | craftEpisodeSubmit |
| `requeue audio` | Ctrl+A | craftEpisodeSubmit |
| `requeue rss` | Ctrl+Y | craftEpisodeDownload |
| `regenerate-script` | Ctrl+G | craftEpisodeSubmit + regenerate |
| `regenerate-audio` | Ctrl+R | craftEpisodeSubmit + regenerate |
| `regenerate-image` | Ctrl+I | craftEpisodeSubmit（画像のみ） |

実装: [scripts/podcast-cli.ts](../../scripts/podcast-cli.ts)、[scripts/tui/data/client.ts](../../scripts/tui/data/client.ts)。

## リモデリング backlog（ギャップから）

1. **制作 status** と **公開 status** の分離（または合成状態機械を 1 枚の図として明文化）。
2. Script / AudioFile の「現在」を、`created_at` 最新クエリではなく第一級の参照で表す。
3. 命令名と挙動の一致（`regenerate-script` が音声・画像まで走る点を UI/ドメインで明示または分割）。
4. 公開済みエピソードのアートワーク再生成に、任意の `refreshFeed` を付けられるようにする。
5. Gemini バッチメタを **TtsJob** 値オブジェクトまたはエンティティとして切り出し、`audio_files` の JSONB だけに頼らない。

## 参照コード

- パイプラインステージ: [pipeline-stages.ts](../../supabase/functions/_shared/pipeline-stages.ts)
- フロー定義: [craft-episode-submit.ts](../../supabase/flows/craft-episode-submit.ts)、[craft-episode-download.ts](../../supabase/flows/craft-episode-download.ts)
- 型: [types.ts](../../supabase/functions/_shared/types.ts)
