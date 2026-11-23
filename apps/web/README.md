# @podcaster/web

Next.js App Router for the Git + Markdoc knowledge layer.

Phase 4: Next.js が公開サイト（一覧・記事・プレイヤー）。`POST /api/capture` は Git に置くだけ。TTS は呼ばない。Markdoc の編集は **hskksk/knowledges** リポジトリ上で行う（ブラウザ CMS は含めない）。

```bash
# from repo root
pnpm knowledge:checkout   # 初回・knowledges 更新後
pnpm web:dev
# Portal:    http://127.0.0.1:3000/
# Podcast:   http://127.0.0.1:3000/podcast
# ふしぎ旅:  http://127.0.0.1:3000/juken
```

## Vercel（推奨）

モノレポなので、Vercel の Project Settings → Root Directory を **`apps/web`** にする（Import 画面の Edit でも可）。`rootDirectory` は vercel.json には書けない。

公開ページは **ビルド時に静的 HTML を焼く**（`force-static`）。

- `/` は hskksk の入口
- `/podcast` と `/podcast/articles/[slug]` は wiki とポッドキャスト。旧 `/`・`/articles/[slug]`・`/search`・`/web-clips` はここへリダイレクトする
- `/juken` は private **`hskksk/knowledges`** の `content/juken/`

Markdoc 本文は **`pnpm knowledge:checkout`** でビルドマシンに取り込んだ `.knowledge-checkout/` から読む（`apps/web` の **prebuild** が Vercel でもこれを実行）。podcaster リポ内の `content/` は使わない。Capture の commit 先も `hskksk/knowledges`。

記事本文は `@markdoc/next.js`（`mode: "static"`）と同じスキーマ（`apps/web/markdoc/`）でコンパイル。正本は knowledges の `content/docs/**/index.mdoc` と `content/web-clips/**/index.mdoc`。

### 初回だけ（knowledges 分割後のデプロイ）

1. **Vercel → podcaster → Environment Variables（Build）**: `KNOWLEDGE_GITHUB_REPO=hskksk/knowledges`, `KNOWLEDGE_GITHUB_TOKEN`（knowledges の **read** のみ。clone 用）
2. 同じ画面で **Install Command** がモノレポ用（例: `cd ../.. && pnpm install`）になっていること。Build Command は既定の `pnpm build`（`apps/web`）でよい — prebuild が checkout する
3. **Runtime**: `CAPTURE_API_TOKEN` と `CAPTURE_GITHUB_TOKEN`（knowledges への **write**）を Production に設定
4. マージ後 Redeploy。ビルドログに `[knowledge] ok CONTENT_ROOT=...` が出れば読み取り OK

詳細は [content-platform-split.md](../../docs/architecture/content-platform-split.md)。

音声プレイヤーと記事挿絵（エピソード画像）も **ビルド時** に解決する（SSG）。画像はそのデプロイの `next build` 時点の DB/RSS スナップショット。追従には再デプロイが必要。

1. **推奨**: Vercel の `SUPABASE_PROJECT_REF`（または `NEXT_PUBLIC_SUPABASE_PROJECT_REF`）と `SUPABASE_SERVICE_ROLE_KEY` を **Build** 環境（Production **と Preview**）に含める。
2. **フォールバック**: サービスロールが無くても、project ref さえあれば公開 RSS（`feed.xml`）から記事タイトル → 音声 URL / `itunes:image` を引く。
3. **任意**: リポジトリの `config.toml` に `[podcast] supabase_project_ref = "…"` を書くと env 未設定の CI でも RSS フォールバックが動く。

Runtime だけにキーを置くとプレイヤーとカバーは空の HTML のままデプロイされる。Preview でカバーだけ出ない場合は、Build ログの `[site] image map empty` と RSS に `<itunes:image>` があるかを確認する。

Vercel 上では `NEXT_PUBLIC_VERCEL_ENV` があるので Capture は自動的に GitHub API を使う。`/api/capture` は `Authorization: Bearer <CAPTURE_API_TOKEN>` のみ（Cloudflare Access を掛けるなら Capture だけ Bypass / Service Token）。

## Capture

```bash
# apps/web/.env.local に CAPTURE_API_TOKEN を入れて pnpm web:dev
pnpm capture --title "クリップ" --file notes.md
pnpm capture --title "記事" --file page.md --url https://example.com
# 既定: web-clips + podcast none。Wiki は --collection docs で podcast queued（main マージ後に ingest）
```

Mac / iPhone（Safari・ショートカット・Web Clip）: [docs/guides/capture-clients.md](../../docs/guides/capture-clients.md)

本番は Octokit で `main` に Direct Commit。GitHub API が 2 秒を超えると `202` + `retryable: true`。同じ body を再送すると既存 SHA を返す。

### ブランチ保護

Capture は `main` 直 commit。保護を掛けるなら次のどちらか:

1. **bypass allowlist** に Capture 用 fine-grained PAT のアクターを入れる（推奨）
2. `main` に保護を掛けない（現状どおり）

Rulesets で「restrict updates」だけを使うと Octokit の Direct Commit は 403 になる。PR 必須ルールは Capture と両立しないので、必須レビューは `content/` 以外、または上記 bypass にする。

## ローカル

`CAPTURE_STORAGE=local`（未設定でもローカル dev はディスク）なら knowledges checkout 配下に直書き。Next は `apps/web/.env.local` だけを読む。

```bash
cp apps/web/.env.example apps/web/.env.local
pnpm knowledge:checkout
pnpm web:dev
```

## 他ホスト

| ホスト | 向き |
|---|---|
| **Vercel** | 公開サイト + Capture の GitHub API。Phase 4 の公開先 |
| Netlify | 同様に GitHub capture なら可 |
| Railway | local storage の常駐プロセス向け（`apps/web/Dockerfile`）。必須ではない |
| Supabase | Next.js のホストではない |