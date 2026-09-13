# Keystatic + Markdoc PKM 移行設計

> 出典: 添付仕様書「次世代パーソナルナレッジ基盤 要件定義・設計仕様書」v1.0.0（2026-09-13）  
> 対象リポジトリ: `hskksk/podcaster`  
> ステータス: 設計（実装前）

この文書は PDF の仕組みを **このリポジトリに載せる** ための設計である。新規リポジトリを切らず、既存の記事・音声・RSS・パイプラインを残したまま、知識の正を Mem.ai から Git + Markdoc に移す。

---

## 1. 結論

PDF の 5 層（入力 / Bridge+GUI / Git / 閲覧編集 / MCP）をそのまま採用する。  
本リポジトリがすでに持っている **ポッドキャスト工場** は、知識層の下流コンシューマとして残す。キャプチャとポッドキャスト投入は分離する。

```
[Clipper / Raycast / iOS / エージェント / curl]
                    │  POST /api/capture
                    ▼
        Next.js (Keystatic + Capture API)
                    │  GitHub Direct Commit
                    ▼
     Git: content/docs + content/web-clips     ← 知識の正
          │
          ├─ 公開サイト（Next.js / 当面は既存 Pages も併用）
          ├─ FastMCP（Cloud Agent）
          └─ 明示トリガーのみ
                    ▼
     既存: ingest → pgflow → TTS → RSS         ← 配信の正（Supabase）
```

Mem.ai は知識ストアとしては廃止対象。既存の `mem_note_id` は参照用に残し、新規パスでは必須にしない。

---

## 2. 既存資産（残すもの）

| 資産 | 現状 | 移行後 |
|------|------|--------|
| `articles/*.md`（36 本） | Git 上の調査メモ兼公開原稿 | `content/docs/*/index.mdoc` に移す。本文は維持 |
| `inbox/*.md`（未 ingest） | 投入待ち原稿 | `content/web-clips/*/index.mdoc`。podcast フラグで投入 |
| GitHub Pages（`scripts/build-web.ts` + `web/template.html`） | `articles/` を静的 HTML 化、音声プレイヤー付き | Phase 4 まで維持。その後 Next.js 公開面が置換。URL リダイレクト必須 |
| `public/cover.png` / `config.toml` | 番組メタデータ | 変更しない |
| Supabase パイプライン（ingest, pgflow, TTS, RSS, Storage） | 記事テキスト → 台本 → 音声 → feed.xml | **実行系として維持**。入力元だけ Git に替える |
| `episodes` / `scripts` / `audio_files` / `processing_logs` | 配信履歴 | 触らない。新規行に `content_path` を足すだけ |
| TUI / CLI | inbox 閲覧、再キュー、ログ | パスと ingest 手順だけ付け替える |
| `podcast-research` スキル | `inbox/*.md` に書いて PR | 保存先を `content/web-clips` または `content/docs` に変更 |
| `packages/gemini-batch-tts` | TTS 実装 | そのまま |
| mem 連携（`MEM_API_KEY`, `create-mem-note-from-file.ts`） | ファイル投入時に mem へ複製 | best-effort のまま残し、失敗しても本線は Git |

Postgres の `articles.content` は **パイプライン実行時点のスナップショット** になる。知識の編集は Git 側で行い、再生成するときだけ DB に流す。

---

## 3. PDF 要件のマッピング

### 3.1 機能要件

| ID | PDF | 本リポジトリでの実現 |
|----|-----|----------------------|
| FR-01 | Keystatic 構造化 Wiki | `apps/web` の Next.js App Router 上で Keystatic。`/keystatic` |
| FR-02 | Web クリップ & クイックメモ | 既存の curl / スキル / TUI を Capture クライアントとして扱う。Chrome 拡張は後追い |
| FR-03 | `POST /api/capture` | Next.js Route Handler。Octokit で `content/web-clips/{slug}/index.mdoc` を commit |
| FR-04 | Markdoc カスタムタグ | まず `callout` / `diagram` / `math` / `podcastPlayer`。既存 `$...$` 数式は互換変換 |
| FR-05 | MCP | `apps/mcp`（FastMCP）。Phase 5。Git 上の `.mdoc` を検索・取得・作成 |

### 3.2 非機能要件

| ID | 採用方針 |
|----|----------|
| NFR-01 ポータビリティ | 正本は Git の Markdoc。独自 DB スキーマに知識を閉じ込めない |
| NFR-02 トークン分離 | `GITHUB_TOKEN` はサーバのみ。クライアントは `CAPTURE_API_TOKEN` |
| NFR-03 キャプチャ速度 | Capture は Git commit まで。ポッドキャスト生成を待たない |
| NFR-04 ネットワーク | Keystatic と Capture は Cloudflare Access + Tunnel（または同等）。`/api/capture` だけ Service Token / Bypass + Bearer |

---

## 4. コンテンツモデル

PDF の 2 コレクションを採用し、ポッドキャスト用に frontmatter を足す。第 3 コレクションは作らない。

```
content/
  docs/{slug}/index.mdoc          # 構造化 Wiki（現行 articles/）
  web-clips/{slug}/index.mdoc     # クリップ & クイックメモ（現行 inbox/）
```

ディレクトリ形式（`path: 'content/docs/*/'`）にする。図や添付を同梱できる。

### 4.1 `docs`（Wiki）

```yaml
---
title: Markdoc: Stripeが開発した「データとしてのドキュメント」システム
publishedAt: 2026-05-12
sourceUrl:           # 任意
podcast: published   # none | queued | published | skipped
legacyFilename: 20260512_100000_markdoc_features.md
---
```

- `podcast: none` … 知識のみ
- `queued` … 次のパイプライン投入対象
- `published` … 既存エピソードあり（移行直後の articles は原則これ）
- `skipped` … 投入しないと明示

### 4.2 `web-clips`（キャプチャ）

```yaml
---
title: 記事またはメモのタイトル
url: https://example.com/article
clippedAt: 2026-09-13T17:20:00.000Z
podcast: none          # クリップ直後は none。Wiki 昇格後に queued
---
```

キャプチャは **Git に置くだけ**。音声生成はしない。

### 4.3 ライフサイクル

```
capture → content/web-clips (podcast: none)
                │
                │ Keystatic で整理 / タグ / callout
                ▼
         content/docs (podcast: none | queued)
                │
                │ 明示トリガー（frontmatter queued / TUI / CLI / スキル）
                ▼
         ingest Edge Function → pgflow → Storage RSS
                │
                ▼
         docs.podcast = published
```

現行の「inbox に置いて main へマージすると自動 ingest」は、移行期間だけ `content/web-clips` または `docs` の `podcast: queued` を見て動かす。定常状態では **queued の明示** を必須にする。思考のキャプチャと 1–2 分の TTS ジョブを結び付けないため。

---

## 5. アプリケーション配置

pnpm workspace を拡げ、Next.js を `apps/web` に置く。ルートの `web/template.html` は Pages 廃止まで残す。

```
apps/web/                 # Next.js + Keystatic + /api/capture
apps/mcp/                 # FastMCP（後続）
content/docs/
content/web-clips/
supabase/                 # 現行のまま
scripts/                  # CLI / TUI / 移行スクリプト
packages/gemini-batch-tts/
```

`keystatic.config.ts` は PDF の形を踏襲し、repo 名と schema だけ本リポジトリ向けにする。

```ts
storage: {
  kind: process.env.NODE_ENV === "production" ? "github" : "local",
  repo: "hskksk/podcaster",
}
```

ローカルは Git 作業ツリー直書き。本番 Keystatic は GitHub storage。Capture API は常に Octokit で commit し、Keystatic のセッションに依存しない。

### 5.1 Capture API（PDF 5.2 を拡張）

`POST /api/capture`

ヘッダ: `Authorization: Bearer <CAPTURE_API_TOKEN>`（constant-time 比較）

```json
{
  "title": "記事またはメモのタイトル",
  "url": "https://example.com/article",
  "content": "Markdoc / Markdown 本文",
  "slug": "optional-override",
  "collection": "web-clips",
  "podcast": "none"
}
```

- 既定 collection は `web-clips`
- slug 省略時は `{YYYY-MM-DD}-{slugified-title}`（PDF 例に合わせる）
- 衝突時は末尾に短ハッシュ
- レスポンスは commit SHA と path。ポッドキャスト job id は返さない
- `collection: "docs"` と `podcast: "queued"` は許可するが、クライアント既定にはしない

生成ファイルは PDF 例どおり:

```
content/web-clips/2026-09-13-article/index.mdoc
```

### 5.2 公開面

| フェーズ | 公開サイト | 編集 UI |
|----------|------------|---------|
| 1–3 | 既存 GitHub Pages（`articles/` または `content/docs` を読むよう build-web を拡張） | 未公開の Keystatic（Access 配下） |
| 4 | Next.js が Pages を置換。音声プレイヤーは現行テンプレ相当 | `/keystatic` は非公開 |

既存 URL `https://hskksk.github.io/podcaster/articles/{slug}.html` はリダイレクトで残す。slug 規則（ファイル名先頭の日付除去）は `legacyFilename` から再現する。

---

## 6. ポッドキャストパイプラインとの接続

実行グラフは変えない。

```
ingest → craftEpisodeSubmit(generateScript → generateAudioStart)
      → download-monitor → craftEpisodeDownload(generateAudioDownload → updateRss)
```

変えるのは **ingest の入力** だけ。

### 6.1 現行の問題

ファイル投入は「Git にある本文」をいったん mem.ai に上げ、その note id で ingest している。本文は既に Git にある。mem は正本ではなく複製。

### 6.2 目標の ingest 契約

既存 `{ title, content }` はそのまま通す（すでに `mem_note_id` なしで動く）。追加フィールド:

```ts
{
  title: string
  content: string
  content_path?: string        // 例: content/docs/markdoc_features/index.mdoc
  content_sha?: string
  source_url?: string
  ingest_route?: "capture" | "keystatic" | "cli" | "inbox_ci" | "skill"
  ingest_meta?: object
  mem_note_id?: string         // レガシー任意
}
```

Postgres は新規 migration で `articles.content_path` / `articles.content_sha` を追加する。既存 `mem_note_id` は NOT NULL にしない（現状どおり nullable）。

### 6.3 投入トリガーの置き換え

| 現行 | 移行後 |
|------|--------|
| `inbox/*.md` push → Actions → mem create → ingest → `git mv articles/` | `podcast: queued` の mdoc を検知して **ファイル本文を直接** ingest。mem は任意 |
| TUI `i` = mem + ingest | Git 上の mdoc を読んで ingest。mem 同期は残しても本線ではない |
| `podcast-research` → `inbox/` PR | `content/docs` または `web-clips` に mdoc を書いて PR。マージ後に queued なら ingest |
| `workflow_dispatch` の mem note URL | 移行期間は残す。定常では `content_path` 指定に置換 |

RSS・Storage・TUI の episodes / logs / requeue は変更しない。

---

## 7. Markdoc 互換

既存原稿は CommonMark + `$` / `$$` 数式。Markdoc タグはまだ無い。

移行スクリプトの方針:

1. 本文はそのまま `.mdoc` に入れる（Markdown は Markdoc の下位互換）
2. frontmatter を付与
3. `$...$` / `$$...$$` はカスタム node `math` に変換してよいが、**初回は生テキストのまま**でもよい。公開面が KaTeX を維持する間はビルド側で今まで通り解釈できる
4. 壊れた frontmatter や未定義タグで ingest を止めない。バリデーションは Keystatic / 公開ビルド側

初期タグ:

| タグ | 用途 |
|------|------|
| `{% callout type="note" %}` | PDF 例。注釈 |
| `{% diagram type="mermaid" %}` | 既存の図ツール調査資産を活かす |
| `{% math display=true %}` | 数式（任意） |
| `{% podcastPlayer episodeId="..." /%}` | 公開ページの音声（Pages の audio map 相当） |

---

## 8. MCP（FR-05 / 5 層目）

Cloud Agent は GitHub を直接触らせず、MCP 経由にする。

最低ツール:

- `search_docs(query)` … docs / web-clips の本文検索
- `get_doc(path)` … 1 ファイル取得
- `write_clip(title, content, url?)` … 内部的に Capture API と同じ commit
- `queue_podcast(path)` … frontmatter を `queued` にして commit（生成そのものは ingest 側）

MCP は `GITHUB_TOKEN` を持たず、Capture / 内部 API を呼ぶ。NFR-02 の二重化を崩さない。

---

## 9. セキュリティ

PDF 6 章をそのまま使う。

- `GITHUB_TOKEN`: Contents write。Vercel / ホストの env のみ
- `CAPTURE_API_TOKEN`: クリップ用。漏洩しても GitHub 権限は無い
- `/keystatic`: Cloudflare Access（GitHub/Google SSO）
- `/api/capture`: Access Bypass または Service Token + Bearer
- 既存 Supabase `ingest` は service_role のまま。公開しない。Capture から直接は呼ばない

キャプチャとポッドキャスト投入を分離しているので、Clipper 用トークンが漏れても TTS / Gemini キーには届かない。

---

## 10. 移行フェーズ

実装はフェーズ順。この PR は設計のみ。

### Phase 0 — 設計（本ドキュメント）

### Phase 1 — 知識層の器

- `apps/web` に Keystatic + ローカル storage
- `content/docs`, `content/web-clips` を追加
- `scripts/migrate-content.ts`: `articles/` → docs、`inbox/` → web-clips。`legacyFilename` を記録
- 移行後も `articles/` `inbox/` は **読み取り互換の stub 期間** を置く（git mv で履歴を保つ）
- パイプライン・Pages・mem はまだ動かさない

### Phase 2 — Capture

- `POST /api/capture` + Bearer
- CLI `pnpm capture --title ... --file ...`（curl の薄いラッパ）
- TUI inbox は `content/web-clips` を読む
- この時点で Mem.ai への新規クリップを止めてよい

### Phase 3 — ポッドキャスト入力を Git に切替

- ingest に `content_path` / `content_sha`
- file ingest から mem 必須を外す（現行の best-effort を本線化）
- Actions: `podcast: queued` の新規 mdoc を ingest
- `podcast-research` の保存先変更
- Pages の audio map は `legacyFilename` または `content_path` で引く

### Phase 4 — 公開サイト

- Next.js が記事一覧・詳細・プレイヤーを描画
- GitHub Pages ワークフローを停止し、旧 URL をリダイレクト
- `web/template.html` / `scripts/build-web.ts` はアーカイブ

### Phase 5 — MCP

- FastMCP を同居。Cloud Agent は repo checkout なしで知識に触れる

### Phase 6 — 掃除

- mem 必須パス、`inbox/` CI、`MEM_API_KEY` の本線利用を削除
- `mem_note_id` 列は履歴として残してよい

各フェーズの完了条件: 既存エピソードの RSS と Storage 音声が壊れないこと。知識ファイルの本文が git blame で追えること。

---

## 11. 既存ファイルの物理移行

例:

```
articles/20260512_100000_markdoc_features.md
  → content/docs/20260512_100000_markdoc_features/index.mdoc

inbox/20260815_095800_reverse_tunnel.md
  → content/web-clips/20260815_095800_reverse_tunnel/index.mdoc
```

- slug は現行ファイル名（拡張子なし）。Pages の slug 規則は `legacyFilename` から計算
- `git mv` 後に frontmatter を足す（履歴を保つ）
- `multi-agent-prompt-consistency.md` のように日付接頭辞が無いものは slug をそのまま使う
- 公開済み相当の docs は `podcast: published`
- inbox 由来は `podcast: queued`（現行 CI がマージで ingest するため）。Phase 3 以降の新規クリップは `none`

---

## 12. 判断済み / 後回し

**今決めること**

- 知識の正は Git + Markdoc。Mem.ai ではない
- キャプチャと TTS は分離する
- コレクションは PDF どおり 2 つ。podcast は frontmatter
- ポッドキャスト実行系（Supabase / pgflow / Gemini TTS）は残す

**実装時に選ぶこと（設計はブロックしない）**

- Next.js のホスト: Vercel か、Tunnel 配下の Docker か。NFR-04 を満たせばどちらでもよい。Keystatic GitHub mode はサーバが必要
- Chrome 拡張 web-clipper の導入時期。Phase 2 は curl / スキル / TUI で FR-02 を満たす
- 数式を Markdoc タグに正規化するタイミング
- MCP のデプロイ先（同じ Next プロセスか別プロセスか）

**やらないこと（この移行の範囲外）**

- pgflow の置き換え
- TTS ベンダー変更
- 記事本文の書き直し
- Mem.ai 上の過去ノートの全件インポート（Git に無いものは必要になったら個別）

---

## 13. リスク

| リスク | 緩和 |
|--------|------|
| Keystatic と Capture の同時書き込みで衝突 | パス規則を collection で分け、slug に日付を入れる。GitHub API は SHA 付き更新 |
| Pages の slug とディレクトリ slug の不一致 | `legacyFilename` とリダイレクト表を移行スクリプトが生成 |
| 自動 ingest がクリップのたびに TTS を撃つ | 既定 `podcast: none` |
| Markdoc 変換で数式が壊れる | Phase 1 は本文無変換。レンダラ側で `$` を維持 |
| mem_note_id 依存のログ / TUI | 列は残す。UI は `content_path` を優先表示 |

---

## 14. 次の実装単位（Phase 1）

1. `apps/web` の Next.js + Keystatic スケルトン（local storage）
2. 空の `content/docs`, `content/web-clips`
3. `articles/` `inbox/` からの `git mv` + frontmatter 付与スクリプト
4. `scripts/build-web.ts` が新旧パスを読めるようにする（公開を止めない）

パイプラインコード（`supabase/functions`）は Phase 3 まで変更しない。
