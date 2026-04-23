# Podcaster

AI が記事を自動でポッドキャストエピソードに変換するシステム。

**スタック**: TypeScript · Supabase (Edge Functions / Storage / Postgres) · Gemini API (LLM + TTS)

## アーキテクチャ

```
POST /functions/v1/ingest
         │
         ▼
   [ingest] → articles テーブル + script-queue
         │
         ▼  (pg_cron 毎分 / 手動)
   [generate-script] → Gemini 2.5 Flash で台本生成 → episodes テーブル + audio-queue
         │
         ▼
   [generate-audio] → Gemini TTS (Host/CoHost 多話者) → Storage/audio/*.wav + rss-queue
         │
         ▼
   [update-rss] → episodes から feed.xml を生成 → Storage/feed.xml (公開 CDN)
```

## ローカル開発

### 前提条件

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (起動済み)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- [pnpm](https://pnpm.io/installation)
- Gemini API キー (`GEMINI_API_KEY`)

### セットアップ

```bash
# 1. 依存関係インストール
pnpm install

# 2. 環境変数の設定
cp .env.example .env.local
# .env.local に GEMINI_API_KEY を記入

# 3. Supabase ローカルスタック起動 (Docker が必要)
supabase start

# 4. migrations + seed を適用
supabase db reset

# 5. Edge Functions をローカルで起動
pnpm functions:serve
```

### テスト記事の送信

別ターミナルで:

```bash
export $(grep -v '^#' .env.local | xargs)
pnpm test:post
```

Supabase Studio (http://localhost:54323) で `articles` / `episodes` のレコードと、
`podcast` バケット内の `audio/*.wav` と `feed.xml` を確認できます。

### キューワーカーの手動実行

pg_cron は本番環境のみ有効です。ローカルでは各 Function を直接 POST で起動します。

```bash
SERVICE_KEY=$(supabase status | grep 'service_role key' | awk '{print $3}')

# 台本生成
curl -i http://localhost:54321/functions/v1/generate-script \
  -H "Authorization: Bearer $SERVICE_KEY"

# 音声生成
curl -i http://localhost:54321/functions/v1/generate-audio \
  -H "Authorization: Bearer $SERVICE_KEY"

# RSS 更新
curl -i http://localhost:54321/functions/v1/update-rss \
  -H "Authorization: Bearer $SERVICE_KEY"
```

## デプロイ (Supabase クラウド)

### 初回設定

1. [Supabase ダッシュボード](https://supabase.com/dashboard)でプロジェクト作成
2. `.env.production` を作成:
   ```
   SUPABASE_PROJECT_REF=<your-ref>
   GEMINI_API_KEY=<your-key>
   INGEST_WEBHOOK_SECRET=<random-secret>
   APP_FUNCTIONS_URL=https://<ref>.supabase.co/functions/v1
   APP_SERVICE_KEY=<service-role-key>
   ```
3. ワンコマンドデプロイ:
   ```bash
   pnpm deploy
   ```

### RSS フィード

デプロイ後の公開 URL:
```
https://<ref>.supabase.co/storage/v1/object/public/podcast/feed.xml
```

この URL を Apple Podcasts / Overcast 等に登録して購読できます。

### 記事の投入 (本番)

```bash
BODY='{"title":"記事タイトル","content":"記事本文..."}'
SIG="sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$INGEST_WEBHOOK_SECRET" | awk '{print $2}')"
curl -X POST https://<ref>.supabase.co/functions/v1/ingest \
  -H "Content-Type: application/json" \
  -H "x-signature: $SIG" \
  -d "$BODY"
```

## 設定

ポッドキャスト設定は `podcast_config` テーブルで管理されます。
Supabase Studio → Table Editor → `podcast_config` から変更可能。

| key | デフォルト値 | 説明 |
|-----|------------|------|
| `podcast.title` | `My AI Podcast` | ポッドキャスト名 |
| `podcast.description` | `AI が生成するテック系ポッドキャスト` | 説明 |
| `podcast.cover_url` | Storage URL | カバー画像 URL |
| `tts.model` | `gemini-2.5-flash-preview-tts` | TTS モデル |
| `tts.host.voice` | `Charon` | ホストの声 |
| `tts.cohost.voice` | `Achird` | コホストの声 |
| `generator.model` | `gemini-2.5-flash` | 台本生成 LLM |

## Claude Code スキル

`.claude/podcast-research/SKILL.md` でテーマ調査レポートを生成し、
`ingest` エンドポイントに POST して自動的にポッドキャスト化できます。
