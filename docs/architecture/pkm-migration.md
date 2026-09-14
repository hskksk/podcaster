# Keystatic + Markdoc PKM 移行設計

> 出典: 添付仕様書「次世代パーソナルナレッジ基盤 要件定義・設計仕様書」v1.0.0（2026-09-13）  
> 対象リポジトリ: `hskksk/podcaster`  
> ステータス: Phase 1 完了（Keystatic + Vercel GitHub storage）。次は Phase 1b  
> 作業計画: [pkm-next.md](./pkm-next.md)  
> レビュー: 独立エージェント 2 系（仕様適合 + 現行コード突合）。判定は **approve-with-changes**。P0/P1 を本版で閉じた。

この文書は PDF の仕組みを **このリポジトリに載せる** ための設計である。新規リポジトリを切らず、既存の記事・音声・RSS・パイプラインを残したまま、知識の正を Mem.ai から Git + Markdoc に移す。

---

## 1. 結論

仕様の 5 層は **入力 / Bridge / Git / GUI / MCP**。Bridge と GUI は Next.js に同居し、公開サイトは Git の下流コンシューマである。  
本リポジトリがすでに持っている **ポッドキャスト工場** も同様に下流コンシューマとして残す。キャプチャとポッドキャスト投入は分離する。

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
| `episodes` / `scripts` / `audio_files` / `processing_logs` | 配信履歴 | **触らない**。参照キーは `articles.content_path` / `articles.content_sha` を新規 migration で足す |
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

このリポジトリは GitHub Pages で公開されている。`content/` も同じ public tree に置く（現行 `articles/` と同じ公開前提）。`web-clips` は公開サイトに出さない（noindex / 非公開ルート）。個人メモを秘密にしたい場合は別 private repo に切り出すが、**この移行の既定は公開リポジトリ**である。

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

現行の「inbox に置いて main へマージすると自動 ingest」は、ファイル移動後だけ `docs`（または昇格済み clips）の `podcast: queued` を見て動かす。定常状態では **queued の明示** を必須にする。思考のキャプチャと 1–2 分の TTS ジョブを結び付けないため。

web-clips → docs の昇格は **move しない**。docs に新規エントリを copy し、元クリップへ `promotedTo: content/docs/{slug}` を付ける。`git mv` は履歴が切れる。

### 4.4 `podcast: queued` 契約（冪等）

現行 CI が安全なのは、ingest 後にファイルが `inbox/` から消えるから。フラグ方式では終端が無いと再 push のたびに TTS される。

1. **検知**: `podcast == queued` の path 集合。新規追加だけでなく、既存ファイルが `queued` になった更新も含む
2. **成功後の書き戻し**: ingest した **同じ GitHub Actions ワークフロー** が `podcast: published` と `content_sha` を同じ commit で書き戻す（`contents: write`）。ingest Edge Function は Git に書かない
3. **一意性**: `articles.content_path` は UNIQUE。衝突時は新規 episode を作らず 409。再生成は既存の `requeue` / 明示 `force`
4. **失敗**: フラグは `queued` のまま残し、再実行可能
5. **Capture 既定**: `podcast: none` のまま。Capture から ingest は呼ばない（`ingest_route: "capture"` は使わない）

移行直後の inbox 4 本を `queued` にするかは Phase 3 の作業時に明示する。黙って一括 TTS しない。

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
  kind: process.env.NEXT_PUBLIC_KEYSTATIC_STORAGE === "github" ||
    process.env.NEXT_PUBLIC_VERCEL_ENV
    ? "github"
    : "local",
  repo: "hskksk/podcaster",
}
```

`NODE_ENV` では切り替えない（`next build` は常に `production`）。Vercel では `NEXT_PUBLIC_VERCEL_ENV` で GitHub storage にする。ローカル `pnpm web:dev` は FS 直書き。GitHub App は `pnpm web:github`（development）で一度作り、env を Vercel にコピーする。Octokit はデプロイ時のみ。本番 Keystatic は GitHub App + ユーザー OAuth（これは `GITHUB_TOKEN` とは別シークレットで、NFR-02 の表に含める）。Capture の対象は `main` 直 commit。ブランチ保護を掛ける場合は Phase 2 で bypass 規則を決める。

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
- GitHub API が 2 秒を超えそうなら 202 を返し、commit はバックグラウンド。失敗時はクライアントが再送する（NFR-03）

生成ファイルは PDF 例どおり:

```
content/web-clips/2026-09-13-article/index.mdoc
```

### 5.2 公開面

| フェーズ | 公開サイト | 編集 UI |
|----------|------------|---------|
| 1 | 既存 GitHub Pages（`articles/` のまま） | Keystatic（local + Vercel GitHub storage）。完了 |
| 1b–3 | Pages は `content/docs` を CommonMark として読む | Keystatic は GitHub OAuth の下 |
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

### 6.1 現行の事実

file モードは **すでに本文を直接 POST** している。`scripts/ingest.ts` / TUI は mem 登録を best-effort にし、失敗しても `content` で ingest する。Edge Function は `content` があれば mem を呼ばない。

mem が必須なのは `mem_note_id` のみの経路（`ingest-mem-note.yml` と TUI の note ingest）だけ。Phase 3 の本作業は mem 外しではなく、**CI / TUI / スキルのパス切替** と `content_path` 記録である。

### 6.2 目標の ingest 契約

既存 `{ title, content }` はそのまま通す（すでに `mem_note_id` なしで動く）。追加フィールド:

```ts
{
  title: string
  content: string
  content_path?: string        // 例: content/docs/markdoc_features/index.mdoc
  content_sha?: string
  source_url?: string
  ingest_route?: "keystatic" | "cli" | "inbox_ci" | "skill" | "queued_ci"
  ingest_meta?: object
  mem_note_id?: string         // レガシー任意
}
```

Postgres は新規 migration で **`articles.content_path` / `articles.content_sha`** を追加する（episodes には足さない）。`content_path` は UNIQUE。既存 `mem_note_id` は現状どおり nullable。

既存の Pages プレイヤーは `ingest_meta.inbox_file`（basename）で音声を引く。TUI ingest はこのキーを付けていない（既存の穴）。ファイル移動と同じ PR で (1) 既存行へ `content_path` / `legacyFilename` を SQL バックフィル、(2) audio map を `inbox_file` **または** `legacyFilename` の OR にする。

Git 正本は `.mdoc` のまま。パイプラインへ渡す本文は ingest 前に正規化する（pgflow は触らない）:

1. YAML frontmatter を除去
2. 既知タグはテキスト化（callout → 本文、diagram → キャプション、math → TeX ソース）
3. 未知タグは中身だけ残す
4. `$` / `$$` はそのまま（現行 `config.toml` の読み下し指示が使える）

この変換は `scripts/ingest.ts` か小さな shared モジュールに閉じる。

### 6.3 投入トリガーの置き換え

| 現行 | 移行後 |
|------|--------|
| `inbox/*.md` push → Actions → mem create → ingest → `git mv articles/` | `podcast: queued` の mdoc を検知して **ファイル本文を直接** ingest。mem は任意 |
| TUI `i` = mem + ingest | Git 上の mdoc を読んで ingest。mem 同期は残しても本線ではない |
| `podcast-research` → `inbox/` PR | checkout 済みエージェント / スキルは作業ツリーに mdoc を書いて PR。checkout 無しの外部 Agent だけ MCP → Capture |
| `workflow_dispatch` の mem note URL | 移行期間は残す。定常では `content_path` 指定に置換 |

RSS・Storage・TUI の episodes / logs / requeue は変更しない。

---

## 7. Markdoc 互換

既存原稿は CommonMark + `$` / `$$` 数式。YAML frontmatter は **0 件**（`---` は水平線として本文に出る）。約 13 本が `$` を含み、Markdoc 解説記事は `{% ... %}` をコード例として含む。

「Markdown ⊂ Markdoc」は危険。`$n$` やフェンス内の `{%` がパーサに食われる。

移行スクリプトの方針（Phase 1b で実施。詳細は [pkm-next.md](./pkm-next.md)）:

1. `.md` は残さない。`content/.../index.mdoc` が正本
2. プロスは無変換。フェンス外の `$` / `$$` と mermaid フェンスだけ既知タグへ機械変換する
3. コードフェンス / インラインコードの `{%` と `$` は触らない
4. Phase 1–3 の公開面（`build-web.ts`）は **Markdoc パーサを掛けない**。textify してから現行どおり CommonMark + KaTeX
5. 壊れた frontmatter や未定義タグで ingest を止めない
6. 変換は可逆: textify 結果が元 `.md` 本文と一致すること

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

書き込み（`write_clip` / `queue_podcast`）は Capture / 内部 API を呼ぶ。読み取り（`search_docs` / `get_doc`）は contents:read のみの `GITHUB_READ_TOKEN` を使うか、checkout 済みランタイム専用にする。書き込み用 `GITHUB_TOKEN` を MCP に渡さない。`queue_podcast` は Capture を更新（PATCH 相当）できるようにしてから載せる。

---

## 9. セキュリティ

PDF 6 章をそのまま使う。

- `GITHUB_TOKEN`: Contents write。ホスト env のみ。Capture のサーバ側が使う
- `KEYSTATIC_GITHUB_CLIENT_*`: Keystatic GitHub App OAuth。`GITHUB_TOKEN` とは別
- `GITHUB_READ_TOKEN`: MCP 読み取り専用（contents:read）。未使用なら MCP は checkout 済み専用
- `CAPTURE_API_TOKEN`: クリップ用。漏洩しても ingest / Gemini / service_role には届かない。ただし **Git への書き込みはできる**（公開 repo のクリップ本文が載る）
- `/keystatic`: Cloudflare Access またはホスト側の同等（Vercel 単独では Access が無いので、選んだホストで「Access 相当」を必須にする）
- `/api/capture`: Access Bypass または Service Token + Bearer
- 既存 Supabase `ingest` は service_role のまま。公開しない。Capture から直接は呼ばない

キャプチャとポッドキャスト投入を分離しているので、Clipper 用トークンが漏れても TTS / Gemini キーには届かない。

---

## 10. 移行フェーズ

実装はフェーズ順。作業計画は [pkm-next.md](./pkm-next.md)。

### Phase 0 — 設計（本ドキュメント）

### Phase 1 — 知識層の器（ファイルは動かさない）✅

- `pnpm-workspace.yaml` に `apps/*` を追加。`apps/web` は独自 `package.json`（root の Ink/React と分離）
- Keystatic + **local** storage for `pnpm web:dev`。Vercel 公開は GitHub storage（`NEXT_PUBLIC_VERCEL_ENV`）
- 空の `content/docs`, `content/web-clips`
- `articles/` `inbox/` は **このフェーズでは git mv しない**。Pages / TUI / inbox CI / スキルがこのパスに結合している
- `supabase/functions` と DB は触らない

完了条件: `pnpm typecheck` が壊れない。`pnpm web:build` が現行 36 HTML を出す。TUI mock が起動する。functions の diff が空。**満たした（#79–#81）。**

### Phase 1b — 物理移動（コンシューマ追随と同一 PR）← 次

`git mv` するなら、同じ PR で次を全部入れる。stub（コピー残し）は作らない。

- `articles/` → `content/docs`、`inbox/` → `content/web-clips`。`legacyFilename` を付与
- `.md` は残さない。フェンス外の数式と mermaid を既知タグへ機械変換（プロスは無変換）
- `scripts/build-web.ts` が `content/docs/**/index.mdoc` を読む（Markdoc パーサは使わない。textify して CommonMark + KaTeX）
- `pages.yml` の `paths` に `content/docs/**`
- audio map を `inbox_file` OR `legacyFilename`。既存行を SQL バックフィル
- TUI の scan 先を新パスへ
- inbox CI は新パスに切り替えるか、この PR で disable するかを選ぶ（黙って死なせない）
- スキル 3 種の保存先を更新

受け入れ: 移行スクリプトの textify 結果が元 36+4 の `.md` 本文と一致。`pnpm web:build` が 36 HTML。`markdoc_features.html` / `勝海舟.html` / `multi-agent-prompt-consistency.html` が残る。数式記事に `math-inline` / `math-display` が残る。Keystatic が全件開ける。

公開 URL slug はディレクトリ名ではない。現行と同じ `parseSlugFromFilename(legacyFilename)`（先頭 `YYYYMMDD` と任意の `_HHMMSS_` を落とす）。日本語は `encodeURIComponent`。関数は一箇所に置く。

### Phase 2 — Capture

- `POST /api/capture` + Bearer。デプロイ時のみ Octokit。開発時は FS 直書き
- ホストを決める（Vercel または Tunnel 配下 Docker）。Access 相当を必須化
- CLI `pnpm capture --title ... --file ...`
- 新規クリップの既定保存先は `content/web-clips`（`podcast: none`）
- Mem.ai への新規クリップを止めてよい

### Phase 3 — ポッドキャスト入力を Git に切替

- ingest に `content_path` / `content_sha`、UNIQUE、正規化前処理
- Actions: `queued` 検知 → ingest → **同じ job が `published` を書き戻す**
- `podcast-research` は mdoc を書いて PR（queued は明示）
- `mem_note_id` のみ経路は残してよい。本線ではない

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
- `git mv` 後に frontmatter を足し、フェンス外の数式と mermaid だけ既知タグへ機械変換する（プロスは書き直さない）
- `multi-agent-prompt-consistency.md` のように日付接頭辞が無いものは slug をそのまま使う
- 公開済み相当の docs は `podcast: published`
- inbox 由来の既定は `podcast: none`。Phase 3 で投入するものだけ `queued` にする
- ディレクトリ slug は現行ファイル名（拡張子なし）。Pages URL は `legacyFilename` から現行規則で再計算する。Capture 新規は `{YYYY-MM-DD}-{slugified-title}`（日本語は slug をファイル名ベースにし、無理に ASCII 化しない）

---

## 12. 判断済み / 後回し

**今決めること**

- 知識の正は Git + Markdoc。Mem.ai ではない
- キャプチャと TTS は分離する
- コレクションは PDF どおり 2 つ。podcast は frontmatter
- ポッドキャスト実行系（Supabase / pgflow / Gemini TTS）は残す

**Phase 1 開始前に閉じたこと（レビュー後）**

- `content/` は現行と同じ公開 Git。web-clips はサイトに出さない
- Phase 1 ではファイルを動かさない。移動は Phase 1b でコンシューマ追随と同一 PR
- `queued` のライターは GitHub Actions。UNIQUE + 409。Capture は ingest しない
- Capture 開発時は FS 直書き。Keystatic 切替は `NEXT_PUBLIC_KEYSTATIC_STORAGE` / Vercel では GitHub
- clips → docs は copy + `promotedTo`
- ingest 本文は frontmatter 除去と既知タグの textify
- 公開 slug 関数は `parseSlugFromFilename(legacyFilename)` と同一
- Phase 1b で `.md` は残さない。数式と mermaid は既知タグへ機械変換する（2026-09-14）

**実装時に選ぶこと（Phase 1 はブロックしない）**

- Next.js のホスト: **Vercel**（GitHub storage）。Tunnel 配下 Docker / Railway は任意
- Chrome 拡張 web-clipper の導入時期。Phase 2 は curl / スキル / TUI で FR-02 を満たす
- MCP のデプロイ先（別プロセス推奨。Python FastMCP ならランタイム追加）

**やらないこと（この移行の範囲外）**

- pgflow の置き換え
- TTS ベンダー変更
- 記事本文の書き直し（数式・mermaid の機械的なタグ化は除く。プロスは触らない）
- Mem.ai 上の過去ノートの全件インポート（Git に無いものは必要になったら個別）

---

## 13. リスク

| リスク | 緩和 |
|--------|------|
| Keystatic と Capture の同時書き込みで衝突 | パス規則を collection で分け、slug に日付を入れる。GitHub API は SHA 付き更新 |
| Pages の slug とディレクトリ slug の不一致 | `legacyFilename` とリダイレクト表を移行スクリプトが生成 |
| 自動 ingest がクリップのたびに TTS を撃つ | 既定 `podcast: none`。queued は Actions が `published` に書き戻す |
| Phase 1 で `git mv` すると Pages/TUI/CI が死ぬ | 移動は Phase 1b。コンシューマ追随と同一 PR |
| Markdoc 変換で数式が壊れる | フェンス外の `$`/`$$` と mermaid だけタグ化。コード内は触らない。Pages は textify してから KaTeX。roundtrip で元 md と一致させる |
| mem_note_id 依存のログ / TUI | 列は残す。UI は `content_path` を優先表示 |

---

## 14. 実装状況

Phase 1 完了（#79–#81）:

1. `pnpm-workspace.yaml` に `apps/*`
2. `apps/web` の Next.js + Keystatic（local は `pnpm web:dev`、Vercel は GitHub storage）
3. 空の `content/docs`, `content/web-clips`（`.gitkeep` のみ）
4. GitHub App ウィザードは development で動作。Vercel へ env をコピー済み

`articles/` と `inbox/` は未移動。パイプラインコード（`supabase/functions`）は Phase 3 まで変更しない。

**次の実装単位は Phase 1b。** 手順・受け入れ条件・やらないことは [pkm-next.md](./pkm-next.md) に切り出した。`scripts/build-web.ts` / `pages.yml` / TUI / スキルは **Phase 1b の移動 PR** で触る。

---

## 15. レビュー記録

独立エージェント 2 系（仕様適合 / 現行コード突合）。判定 **approve-with-changes**。

取り入れた P0:

- Phase 1 の `git mv` を撤回。Pages / TUI / inbox CI が `articles/` `inbox/` に結合している
- `queued` の終端・冪等・UNIQUE・書き戻し主体を契約にした

取り入れた P1:

- file ingest は既に raw content 本線（§6.1 の誤認を訂正）
- `content_path` は `articles` のみ
- 公開 repo へのクリップ直書きを明示
- audio map の `inbox_file` バックフィル
- Keystatic storage を `KEYSTATIC_STORAGE` に
- mdoc → 台本入力の正規化
- 昇格は copy。エージェント経路を 2 系統に分離
- MCP 読み取りトークン
- Phase 1–3 は Markdoc パーサを Pages に掛けない

残した良い判断: 知識の正 = Git、配信の正 = Supabase、キャプチャと TTS の分離、第 3 コレクションを作らない、トークン二層、Mem 全件 import をしない。
