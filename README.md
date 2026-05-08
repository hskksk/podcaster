# Podcaster

記事テキストを投入すると、AI が自動で**対話形式のポッドキャスト音声**と **RSS フィード**を生成するシステム。

- 台本: Gemini 2.5 Flash で Host / CoHost の掛け合い形式（日本語）
- 音声: Gemini TTS のマルチスピーカー合成（WAV 形式）
- 配信: Supabase Storage の公開バケット（グローバル CDN）

**スタック**: TypeScript / Deno · Supabase Edge Functions · Supabase Storage · Supabase Postgres + pgflow · Gemini API

---

## アーキテクチャ

```
外部トリガー（curl / Claude Code / Mem AI）
         │
         │ POST /functions/v1/ingest  {title, content}
         ▼
┌─────────────────────┐
│      ingest         │  mem_note_id 検証 → articles / episodes を作成
└────────┬────────────┘
         │ pgflow.start_flow("craftEpisode")
         ▼
┌─────────────────────┐
│  generate_script    │  Gemini Flash でホスト/コホスト台本を JSON 生成
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  generate_audio     │  Gemini TTS 多話者合成 → PCM→WAV 変換 → Storage 保存
└────────┬────────────┘
         ▼
┌─────────────────────┐
│    update_rss       │  DB から全エピソードを取得 → RSS 2.0 + iTunes 形式で feed.xml 生成
└─────────────────────┘
         │
         ▼
Supabase Storage (公開バケット `podcast`)
  ├── feed.xml          ← RSS フィード（CDN 配信）
  ├── audio/<id>.wav    ← 音声ファイル（CDN 配信）
  └── cover.png         ← カバー画像
```

本番環境では pgflow migration が作成する `pgflow_ensure_workers` cron が  
`craft-episode-worker` の死活監視と再起動を行います。

---

## ディレクトリ構成

```
podcaster/
├── public/
│   └── cover.png                   # ポッドキャストカバー画像
├── scripts/
│   ├── lib/
│   │   ├── supabase-detect.ts      # ローカル / リモート Supabase 接続情報の自動検出
│   │   └── table.ts                # CLI 用テーブル表示ヘルパー
│   ├── deploy.ts                   # pnpm deploy の実体
│   ├── ingest.ts                   # mem note ID を指定して記事を投入
│   ├── podcast-cli.ts              # パイプライン状態確認 CLI
│   ├── post-test-article.ts        # ローカル動作確認用テスト記事投入
│   └── seed-config.ts              # cover.png アップロード + podcast_config 初期化
├── supabase/
│   ├── config.toml                 # Supabase CLI 設定（ポート等）
│   ├── migrations/
│   │   ├── 20260423000001_initial.sql        # articles / episodes / Storage バケット
│   │   ├── ...                               
│   │   ├── 20260507031725_..._pgflow_initial.sql
│   │   └── 20260507031744_..._pgflow_step_conditions.sql
│   ├── flows/
│   │   ├── index.ts                # pgflow フローのエクスポート
│   │   └── craft-episode.ts        # 本番フロー定義
│   └── functions/
│       ├── _shared/
│       │   ├── db.ts       # Supabase クライアント
│       │   ├── pipeline-stages.ts # 各ステージ共通実装
│       │   ├── config.ts   # podcast_config ローダー
│       │   └── types.ts    # 共有型定義
│       ├── ingest/         # Webhook 受信
│       ├── craft-episode-worker/ # pgflow 実行ワーカー
│       └── pgflow/         # pgflow ControlPlane（フロー定義配信/管理）
├── .env.example
├── package.json
└── tsconfig.json
```

---

## ローカル開発

### 前提条件

| ツール | インストール |
|--------|------------|
| Docker Desktop | https://www.docker.com/products/docker-desktop/ |
| Supabase CLI | `brew install supabase/tap/supabase` |
| pnpm | `npm install -g pnpm` |
| Gemini API キー | https://aistudio.google.com/apikey |

### セットアップ（初回）

```bash
# 1. 依存関係インストール
pnpm install

# 2. pgflow のセットアップ（初回または更新時）
pnpm pgflow:install

# 3. 環境変数ファイルを作成し API キーを記入
cp .env.example .env.local
# → GEMINI_API_KEY と MEM_API_KEY を設定

# 4. Supabase ローカルスタックを起動（Docker が必要）
supabase start

# 5. マイグレーション適用
supabase db reset

# 6. カバー画像をアップロードし podcast_config を初期化
#    （supabase status から接続情報を自動取得）
pnpm seed:config

# 7. Edge Functions をローカルで起動
pnpm functions:serve &
```

起動後のアクセス先:

| サービス | URL |
|---------|-----|
| Supabase Studio | http://localhost:54333 |
| Edge Functions | http://localhost:54331/functions/v1/ |
| RSS フィード | http://localhost:54331/storage/v1/object/public/podcast/feed.xml |

### テスト記事の投入

別ターミナルで:

```bash
MEM_NOTE_ID=<your-mem-note-id> pnpm test:post
pnpm test:post
```

（`SUPABASE_SERVICE_ROLE_KEY` は `supabase status` から自動取得）

202 が返ったら成功。あとは worker を起動すればフローが進行します。

### ワーカーの手動実行

本番では `pgflow_ensure_workers` が自動実行しますが、ローカルでは手動で呼べます。

```bash
# service_role key を取得
KEY=$(supabase status --json | python3 -c "import sys,json; print(json.load(sys.stdin)['SERVICE_ROLE_KEY'])")

# craft episode worker（フロー実行）
curl -s http://localhost:54331/functions/v1/craft-episode-worker \
  -H "Authorization: Bearer $KEY"
```

進捗は Studio の Table Editor (`episodes` テーブルの `status` 列) か、
Storage の `podcast` バケットで確認できます。

### 次回以降の起動

```bash
supabase start
pnpm functions:serve
```

---

## CLI ツール

`pnpm cli` でパイプラインの状態をローカルから確認できます。

```bash
# ローカル Supabase に接続（supabase start が必要）
TARGET=local pnpm cli <command>

# 本番に接続（デフォルト）
pnpm cli <command>
```

接続情報は `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 環境変数か、
Supabase CLI (`supabase status` / `supabase projects api-keys`) から自動取得します。

### コマンド一覧

#### `list episodes`

最新 N 件のエピソードを一覧表示します。

```bash
pnpm cli list episodes           # 最新 10 件
pnpm cli list episodes --limit 5 # 最新 5 件
```

```
ID        Title                                               Status        Created At
--------  --------------------------------------------------  ------------  -------------------
a1b2c3d4  Supabase の pgmq でバックグラウンドジョブを実装…  audio_ready   2026-04-26 12:34:56
```

#### `list articles`

最新 N 件の記事を一覧表示します。

```bash
pnpm cli list articles
pnpm cli list articles --limit 20
```

#### `list audio`

`audio_files` テーブルの最新 N 件を一覧表示します（ストレージパス・MIME タイプ・ステータス）。

```bash
pnpm cli list audio
pnpm cli list audio --limit 5
```

#### `download audio <id>`

音声ファイルを Storage バケット `podcast` からダウンロードし、`./downloads/` に保存します。
`<id>` は `audio_files.id` または `audio_files.episode_id` のどちらでも指定できます。

```bash
pnpm cli download audio a1b2c3d4-...
# → downloads/audio/<episode_id>.wav に保存
```

#### `status <article_id>`

1 つの記事に対するパイプライン全体の状態を表示します。

```bash
pnpm cli status a1b2c3d4-e5f6-...
```

```
Article
-------
ID        Title                    Source  Created At
--------  -----------------------  ------  -------------------
a1b2c3d4  Supabase の pgmq で…   mem     2026-04-26 12:00:00

Episode
-------
ID        Title                    Status       Created At
--------  -----------------------  -----------  -------------------
b2c3d4e5  第42回：キューイングを…  audio_ready  2026-04-26 12:05:00

Script
------
ID        Episode   Status  Created At
--------  --------  ------  -------------------
c3d4e5f6  b2c3d4e5  ready   2026-04-26 12:06:00

Audio
-----
ID        Episode   Storage Path              MIME       Status  Created At
--------  --------  ------------------------  ---------  ------  -------------------
d4e5f6a7  b2c3d4e5  audio/b2c3d4e5.wav        audio/wav  ready   2026-04-26 12:10:00
```

#### `logs`

処理ログ（`processing_logs` テーブル）を新しい順に一覧表示します。ステータス・エピソード ID でフィルタできます。
`queue_name` は移行期間の暫定として空文字で保存しているため、`--queue` フィルタは基本的に使いません。

```bash
pnpm cli logs                          # 最新 20 件
pnpm cli logs --limit 50               # 最新 50 件
pnpm cli logs --status failure         # 失敗ログのみ
pnpm cli logs --episode b2c3d4e5-...   # 特定エピソードのみ
```

#### `requeue ... <id>`

パイプラインの特定ステージを再実行します。ジョブが失敗したときや再処理が必要な場合に使います。
実行前にレコードの存在確認を行い、確認プロンプトを表示します（`--yes` で省略可）。

| サブコマンド | 対象テーブル | 開始ステージ | 送信 payload |
|------------|-----------|------------|----------|
| `script` | `episodes` | `script` | `{ episodeId, startFrom: "script", trigger: "manual" }` |
| `audio` | `episodes` | `audio` | `{ episodeId, startFrom: "audio", trigger: "manual" }` |
| `rss` | `episodes` | `rss` | `{ episodeId, startFrom: "rss", trigger: "manual" }` |
| `regenerate-script` | `episodes` | `script` | `{ episodeId, startFrom: "script", regenerate: true, trigger: "manual" }` |
| `regenerate-audio` | `episodes` | `audio` | `{ episodeId, startFrom: "audio", regenerate: true, trigger: "manual" }` |

```bash
# 台本生成からやり直す（記事 ID を指定）
pnpm cli requeue script a1b2c3d4-e5f6-...

# 音声生成からやり直す（エピソード ID を指定）
pnpm cli requeue audio b2c3d4e5-f6a7-...

# RSS 更新だけ再実行する（確認プロンプトをスキップ）
pnpm cli requeue rss b2c3d4e5-f6a7-... --yes

# 既存 episode を維持したまま script→audio→rss を再生成する
pnpm cli requeue regenerate-script b2c3d4e5-f6a7-...

# 既存 episode を維持したまま audio→rss を再生成する
pnpm cli requeue regenerate-audio b2c3d4e5-f6a7-...
```

```
Episode: 第42回：キューイングを… (b2c3d4e5)
Start flow {"episodeId":"b2c3d4e5-...","startFrom":"script","trigger":"manual"} → script? [y/N] y
Flow started (script): {"episodeId":"b2c3d4e5-...","startFrom":"script","trigger":"manual"}
```

---

## 本番デプロイ（Supabase クラウド）

### 初回準備

1. [Supabase ダッシュボード](https://supabase.com/dashboard) でプロジェクトを作成
2. Supabase CLI にログイン:

```bash
supabase login
```

3. `.env.production` を作成（AI API キーのみ）:

```bash
GEMINI_API_KEY=<your-gemini-api-key>
MEM_API_KEY=<your-mem-api-key>
```

4. ワンコマンドでデプロイ:

```bash
pnpm deploy
```

デプロイの内容:
1. `supabase projects list` でプロジェクト自動検出（複数ある場合は `SUPABASE_PROJECT_REF` を env に設定）
2. `supabase projects api-keys` でサービスロールキー自動取得
3. `supabase link` でプロジェクトに接続
4. `supabase secrets set` で AI API キーを Edge Function に反映
5. `supabase db push` でマイグレーションを適用
6. worker 管理用 Vault secret (`supabase_project_id`, `pgflow_auth_secret`) を更新
7. `pgflow.track_worker_function('craft-episode-worker')` で監視対象を登録
8. `supabase functions deploy` で Edge Functions（`ingest`, `craft-episode-worker`, `pgflow`）をデプロイ
9. `seed-config.ts` で `cover.png` をアップロードし `podcast_config` を初期化

### 本番 RSS フィード URL

```
https://<ref>.supabase.co/storage/v1/object/public/podcast/feed.xml
```

Apple Podcasts / Overcast / Pocket Casts 等にこの URL を登録して購読できます。

### 記事の投入（本番）

```bash
curl -X POST https://<ref>.supabase.co/functions/v1/ingest \
  -H "Content-Type: application/json" \
  -d '{"title": "タイトル", "mem_note_id": "<your-mem-note-id>"}'
```

本番では `pgflow_ensure_workers` が worker を自動起動します。

---

## GitHub Actions による自動デプロイ

`main` ブランチへの push で Supabase クラウドへ自動デプロイされます。

### 必要な GitHub Secrets

GitHub リポジトリの **Settings → Secrets and variables → Actions** で以下を登録してください。

| Secret | 取得方法 |
|--------|---------|
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens でトークン発行 |
| `SUPABASE_DB_PASSWORD` | プロジェクト作成時に設定したDBパスワード |
| `SUPABASE_PROJECT_REF` | `supabase projects list` で確認（以下の自動登録スクリプトで設定可） |
| `GEMINI_API_KEY` | `.env` の値（以下の自動登録スクリプトで設定可） |
| `MEM_API_KEY` | `.env` の値（以下の自動登録スクリプトで設定可） |

### Secrets の一括登録（オプション）

`SUPABASE_PROJECT_REF` / `GEMINI_API_KEY` / `MEM_API_KEY` の 3 つは以下で自動登録できます（[GitHub CLI](https://cli.github.com/) が必要）:

```bash
pnpm setup:gh-secrets
```

`SUPABASE_ACCESS_TOKEN` と `SUPABASE_DB_PASSWORD` は GitHub Settings から手動登録してください。

---

## 設定

ポッドキャストの設定は `podcast_config` テーブル（キー/値形式）で管理します。
Studio → Table Editor → `podcast_config` から直接編集できます。

| キー | デフォルト値 | 説明 |
|------|------------|------|
| `podcast.title` | `My AI Podcast` | ポッドキャスト名 |
| `podcast.description` | `AI が生成するテック系ポッドキャスト` | 説明文 |
| `podcast.cover_url` | Storage の `cover.png` URL | カバー画像 URL |
| `generator.model` | `gemini-2.5-flash` | 台本生成 LLM モデル |
| `tts.model` | `gemini-2.5-flash-preview-tts` | TTS モデル |
| `tts.instructions` | *(自然な会話トーンで…)* | TTS への合成指示 |
| `tts.host.name` | `Host` | ホストのスクリプト上の名前 |
| `tts.host.voice` | `Charon` | ホストの音声 |
| `tts.cohost.name` | `CoHost` | コホストのスクリプト上の名前 |
| `tts.cohost.voice` | `Achird` | コホストの音声 |

利用可能な Gemini TTS 音声: `Charon`, `Achird`, `Kore`, `Puck`, `Leda` など
（[全一覧](https://ai.google.dev/gemini-api/docs/speech-generation)）

---

## Claude Code スキル

`.claude/podcast-research/SKILL.md` にスキルが定義されています。

```
/podcast-research <テーマ>
```

と呼び出すと、Claude Code がテーマを深く調査してレポートを作成し、
`ingest` エンドポイントに自動 POST してパイプラインを起動します。

例:

```
/podcast-research Supabase の pgmq でバックグラウンドジョブを実装する方法
```

---

## トラブルシューティング

**`supabase start` でポートが競合する**

他のプロジェクトの Supabase スタックが起動中の場合、`supabase/config.toml` のポートを変更してください（本プロジェクトは 54331〜54337 を使用）。

**`generateAudio` ステージが失敗する（Broken pipe）**

Gemini TTS が返す音声は 5 分エピソードで約 14 MB の WAV になります。
ローカルの Docker Storage でメモリ不足が発生する場合は、テスト記事の文字数を減らして試してください。

**`generateScript` ステージが JSON を返さない**

Gemini Flash が稀にフォーマットを外れた応答をすることがあります。
`responseSchema` で構造を強制していますが、それでも失敗した場合は `episodes.error` 列でエラー内容を確認し、記事の `status` を `script_ready` に戻してワーカーを再実行してください。

**本番で pg_cron が動かない**

`pnpm deploy` を再実行すると Vault と worker 登録が更新されます。
Studio → Database → Cron Jobs で `pgflow_ensure_workers` ジョブが有効か、
Studio → Database → Vault で `supabase_project_id` と `pgflow_auth_secret` が保存されているか確認してください。
