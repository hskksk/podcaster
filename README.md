# Podcaster

記事テキストを投入すると、AI が自動で**対話形式のポッドキャスト音声**と **RSS フィード**を生成するシステム。

- 台本: Gemini 2.5 Flash で Host / CoHost の掛け合い形式（日本語）
- 音声: Gemini TTS のマルチスピーカー合成（WAV 形式）
- 配信: Supabase Storage の公開バケット（グローバル CDN）

**スタック**: TypeScript / Deno · Supabase Edge Functions · Supabase Storage · Supabase Postgres + pgmq · Gemini API

---

## アーキテクチャ

```
外部トリガー（curl / Claude Code / Mem AI）
         │
         │ POST /functions/v1/ingest  {title, content}
         ▼
┌─────────────────────┐
│      ingest         │  mem_note_id 検証 → articles テーブルに保存
└────────┬────────────┘
         │ pgmq: script-queue
         ▼
┌─────────────────────┐
│  generate-script    │  Gemini Flash でホスト/コホスト台本を JSON 生成
└────────┬────────────┘
         │ pgmq: audio-queue
         ▼
┌─────────────────────┐
│  generate-audio     │  Gemini TTS 多話者合成 → PCM→WAV 変換 → Storage 保存
└────────┬────────────┘
         │ pgmq: rss-queue
         ▼
┌─────────────────────┐
│    update-rss       │  DB から全エピソードを取得 → RSS 2.0 + iTunes 形式で feed.xml 生成
└─────────────────────┘
         │
         ▼
Supabase Storage (公開バケット `podcast`)
  ├── feed.xml          ← RSS フィード（CDN 配信）
  ├── audio/<id>.wav    ← 音声ファイル（CDN 配信）
  └── cover.png         ← カバー画像
```

各ステージは pgmq キューで連結されており、失敗時は visibility timeout 後に自動再試行。
本番環境では pg_cron が毎分ワーカーを呼び出す。

---

## ディレクトリ構成

```
podcaster/
├── public/
│   └── cover.png                   # ポッドキャストカバー画像
├── scripts/
│   ├── deploy.ts                   # pnpm deploy の実体
│   ├── post-test-article.ts        # ローカル動作確認用テスト記事投入
│   └── seed-config.ts              # cover.png アップロード + podcast_config 初期化
├── supabase/
│   ├── config.toml                 # Supabase CLI 設定（ポート等）
│   ├── migrations/
│   │   ├── 20260423000001_initial.sql        # articles / episodes / Storage バケット
│   │   ├── 20260423000002_queues.sql         # pgmq キュー作成
│   │   ├── 20260423000003_cron.sql           # pg_cron / pg_net 有効化
│   │   ├── 20260423000004_seed_config.sql    # podcast_config デフォルト値
│   │   ├── 20260423000005_queue_helpers.sql  # JS クライアント向け RPC ラッパー
│   │   └── 20260424000001_cron_upgrade.sql   # 旧 cron ジョブ削除（deploy.ts が再作成）
│   └── functions/
│       ├── _shared/
│       │   ├── db.ts       # Supabase クライアント
│       │   ├── queue.ts    # pgmq 操作ヘルパー
│       │   ├── config.ts   # podcast_config ローダー
│       │   └── types.ts    # 共有型定義
│       ├── ingest/         # Webhook 受信
│       ├── generate-script/# LLM 台本生成
│       ├── generate-audio/ # TTS 音声生成
│       └── update-rss/     # RSS フィード更新
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

# 2. 環境変数ファイルを作成し API キーを記入
cp .env.example .env.local
# → GEMINI_API_KEY と MEM_API_KEY を設定

# 3. Supabase ローカルスタックを起動（Docker が必要）
supabase start

# 4. マイグレーション適用（テーブル・キュー・cron を初期化）
supabase db reset

# 5. カバー画像をアップロードし podcast_config を初期化
#    （supabase status から接続情報を自動取得）
pnpm seed:config

# 6. Edge Functions をローカルで起動
pnpm functions:serve
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

202 が返ったら成功。その後ワーカーを順番に呼び出す（後述）。

### ワーカーの手動実行

本番では pg_cron が毎分自動実行しますが、ローカルでは手動で呼びます。

```bash
# service_role key を取得
KEY=$(supabase status --json | python3 -c "import sys,json; print(json.load(sys.stdin)['SERVICE_ROLE_KEY'])")

# 台本生成（ingest 後に実行）
curl -s http://localhost:54331/functions/v1/generate-script \
  -H "Authorization: Bearer $KEY"

# 音声生成（generate-script 完了後）
curl -s http://localhost:54331/functions/v1/generate-audio \
  -H "Authorization: Bearer $KEY"

# RSS 更新（generate-audio 完了後）
curl -s http://localhost:54331/functions/v1/update-rss \
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
6. サービスキーを Supabase Vault に保存（pg_cron が安全に参照）
7. pg_cron ジョブを作成（毎分 Edge Function を自動実行）
8. `supabase functions deploy` で 4 つの Edge Function をデプロイ
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

本番では pg_cron が 1 分以内に各ワーカーを自動起動します。

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

**`generate-audio` が失敗する（Broken pipe）**

Gemini TTS が返す音声は 5 分エピソードで約 14 MB の WAV になります。
ローカルの Docker Storage でメモリ不足が発生する場合は、テスト記事の文字数を減らして試してください。

**`generate-script` が JSON を返さない**

Gemini Flash が稀にフォーマットを外れた応答をすることがあります。
`responseSchema` で構造を強制していますが、それでも失敗した場合は `episodes.error` 列でエラー内容を確認し、記事の `status` を `script_ready` に戻してワーカーを再実行してください。

**本番で pg_cron が動かない**

`pnpm deploy` を再実行すると Vault と cron ジョブが再作成されます。
Studio → Database → Cron Jobs で 3 つのジョブが登録されているか、
Studio → Database → Vault で `service_key` が保存されているか確認してください。
