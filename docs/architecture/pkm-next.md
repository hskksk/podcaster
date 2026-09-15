# PKM 今後の開発計画

> 日付: 2026-09-15（Phase 2–4 完了反映）  
> 前提: Phase 1b（物理移動 + コンシューマ追随）完了。  
> 設計の正: [pkm-migration.md](./pkm-migration.md)  
> 次の実装: **Phase 5（MCP）**。

この文書は設計の再定義ではない。Phase 1 完了時点の事実と、残作業を **実装順・PR 境界・受け入れ条件** に落とした作業計画である。

---

## 1. いまの事実

| 層 | 状態 |
|----|------|
| 知識の器 | `apps/web` の Next.js + Keystatic。ローカルは FS、Vercel は GitHub storage |
| 編集 UI | `/keystatic` が Vercel 上で GitHub ログインできる |
| 知識ファイル | `content/docs`（公開 wiki）と `content/web-clips`（クリップ）。正本は `index.mdoc`（36+4 本移行済み） |
| 公開サイト | Next.js（`/`・`/articles/[slug]`）。GitHub Pages は旧 URL リダイレクト（Phase 4） |
| 投入待ち | web-clips 既定 `podcast: none`。`queued` は `pnpm ingest:queued` / Actions（Phase 3） |
| 配信 | Supabase ingest → pgflow → TTS → RSS（`content_path` 対応済み） |
| Capture | ✅ `POST` / `PATCH /api/capture`（#87）。CLI `pnpm capture`。クライアント手順は [capture-clients.md](../guides/capture-clients.md) |
| MCP | 未実装（`apps/mcp` なし） |

---

## 2. 変えない原則

設計書 §12 の判断を再掲する。実装中に覆さない。

- 知識の正は Git + Markdoc。Mem.ai ではない
- 配信の正は Supabase（pgflow / Gemini TTS / RSS）
- キャプチャと TTS は分離する。クリップしただけでは音声を作らない
- コレクションは `docs` と `web-clips` の 2 つ。podcast は frontmatter
- ファイル移動は **コンシューマ追随と同一 PR**。stub（コピー残し）は作らない
- Phase 1–3 の Pages は Markdoc パーサを掛けない（CommonMark + KaTeX のまま）
- 既存エピソードの RSS と Storage 音声を壊さない
- 知識ファイルのプロスは git blame で追えること（`git mv` + 機械変換のみ。文章の再構成はしない）

---

## 3. 実装順

```
Phase 1b  物理移動 + コンシューマ追随     ✅ (#83)
Phase 2   Capture API（Git に置くだけ）   ✅ (#87)
Phase 3   ポッドキャスト入力を Git に切替  ✅ (#88)
Phase 4   Next.js 公開サイト（Pages 置換） ✅ (#90, #94)
Phase 5   MCP                              ← 次
Phase 6   mem / inbox CI 掃除
```

---

## 4. Phase 1b — 物理移動（完了）

**目的**: Keystatic が現行ナレッジを編集でき、Pages が同じ URL で同じ本文を出し続ける。

**1 PR に全部入れる。** 分割すると Pages / TUI / inbox CI が途中で死ぬ。設計書 §10 / §13 のとおり。

### 4.1 ファイル移動

| 現行 | 移行後 | podcast 初期値 |
|------|--------|----------------|
| `articles/*.md`（36） | `content/docs/{basename}/index.mdoc` | `published` |
| `inbox/*.md`（4） | `content/web-clips/{basename}/index.mdoc` | `none` |

- basename は拡張子なしの現行ファイル名（日付接頭辞付きを含む）
- `legacyFilename` に現行 basename を入れる
- **`.md` のまま残さない。** Keystatic の正本は `index.mdoc`
- `git mv` 相当で履歴を付けたあと、frontmatter 追加と下記の機械変換を行う
- `multi-agent-prompt-consistency.md` のように日付接頭辞が無いものは slug をそのまま使う
- inbox 4 本は **この PR で ingest / TTS しない**（設計書: 黙って一括 TTS しない）

#### 4.1.1 `.md` → `.mdoc` で変換するもの / しないもの

プロス（見出し・段落・リスト）は書き直さない。変換はスクリプトで、コードフェンスの中は触らない。

| 対象 | 件数の目安 | 変換 |
|------|------------|------|
| ファイル配置と拡張子 | 36+4 | `*.md` → `{basename}/index.mdoc` |
| YAML frontmatter | 0 件（現行に無し） | 先頭に付与 |
| `$$...$$` / `$...$` 数式 | articles 側に十数本 | `{% math display=true %}` / `{% math display=false %}` |
| ` ```mermaid ` フェンス | 2 本 | `{% diagram type="mermaid" %}` |
| コードフェンス内の `{%`・`$` | markdoc 解説など | **そのまま**（パーサに食わせない） |
| インラインコードの `{% tag %}` | 同上 | **そのまま** |
| callout / podcastPlayer | 現行に無し | 作らない |
| 文章の再構成 | — | **しない** |

`$` の誤変換（`$HOME` 等）を避ける。フェンス外の `$...$` / `$$` だけを対象にし、変換結果は textify で元の md に戻せることをテストする。

実装メモ（Keystatic `wrapper()` 制約）:

- インライン `$...$` はタグ化しない。`{% math display=false %}` を段落内に置くと “tag has unexpected children” で編集 UI が落ちる
- 引用内の `> $$` と、同じ行に後続テキストがある `$$...$$（注）` もタグ化しない（blockquote / 閉じタグが壊れる）
- 独立した display `$$` と mermaid フェンスだけ既知タグにする。Pages は textify 後の `$`/`$$` を現行どおり KaTeX する

例:

```
articles/20260512_100000_markdoc_features.md
  → content/docs/20260512_100000_markdoc_features/index.mdoc

inbox/20260815_095800_reverse_tunnel.md
  → content/web-clips/20260815_095800_reverse_tunnel/index.mdoc
```

移行スクリプトは `scripts/` に置き、再現可能にする。手作業の一括 `sed` だけで終わらせない。

### 4.2 同じ PR で追随するコンシューマ

| 対象 | 変更 |
|------|------|
| `scripts/build-web.ts` | `content/docs/**/index.mdoc` を読む。frontmatter 除去 + 既知タグの textify（`math` → `$`/`$$`、`diagram` → mermaid フェンス）のあと、現行 marked + KaTeX。公開 slug は `parseSlugFromFilename(legacyFilename)` と同一（関数は一箇所）。**Markdoc パーサは掛けない** |
| `.github/workflows/pages.yml` | `paths` に `content/docs/**` |
| audio map | `ingest_meta.inbox_file` **または** `legacyFilename` の OR。既存行は SQL バックフィル |
| TUI `scripts/tui/data/client.ts` | `scanDir("inbox")` / `scanDir("articles")` を新パスへ。ingest ショートカットも新パス |
| `.github/workflows/ingest-articles.yml` | **この PR で disable**（または paths を外して no-op）。新パスへ切替えて自動 ingest を残すと、移動した 4 本や今後のクリップが TTS される |
| スキル 3 種 | 保存先を `content/web-clips/` の mdoc に。PR マージで自動 ingest する前提を外す。`podcast: none` |
| `README.md` / `CLAUDE.md` / `AGENTS.md` | `articles/` `inbox/` を現行パスとして書いている箇所を更新 |

スキル（いずれも保存先と「マージで ingest」の文言）:

- `.claude/skills/podcast-research/SKILL.md`
- `.agents/skills/podcast-research/SKILL.md`
- `.agents/skills/oss-arch-research/SKILL.md`
- `.agents/skills/prompt-engineering-research/SKILL.md`

### 4.3 inbox CI の扱い（この PR で決める）

推奨: **disable**。理由:

1. 移動する 4 本は `podcast: none`。自動 ingest すると設計に反する
2. Phase 3 まで queued の終端（Actions が `published` を書き戻す）が無い。フラグ方式を先に足すと再 push のたびに TTS される
3. スキルからの新規クリップも、Phase 2–3 までは PR レビューで知識として入れる

TUI からの明示 ingest（ファイル本文 POST）は残してよい。自動 CI だけ止める。

### 4.4 データベース

Phase 3 の `articles.content_path` UNIQUE はこの PR では必須にしない。ただし Pages の音声リンクを守るため:

1. 既存 `articles.ingest_meta->>'inbox_file'` を確認する
2. audio map を `inbox_file` OR `legacyFilename` にする
3. 欠けている行があれば SQL バックフィル（`legacyFilename` 相当を `ingest_meta` に足すか、build-web 側の OR だけで足りるか実データで決める）

`supabase/functions` の TypeScript は **まだ触らない**。

### 4.5 受け入れ条件

設計書 §10 Phase 1b を、mdoc 機械変換に合わせて次のように読む。

- 移行スクリプトの **textify（frontmatter 除去 + 既知タグ戻し）** が、元の 36+4 本の `.md` 本文と一致する
- `pnpm web:build` が 36 HTML を出す。数式記事の HTML は現行と同等（`math-inline` / `math-display` が残る）
- `markdoc_features.html` / `勝海舟.html` / `multi-agent-prompt-consistency.html` が残る
- Keystatic が 36+4 を開ける（未定義タグや生の `{%` で落ちない）
- 公開 URL は現行どおり `https://hskksk.github.io/podcaster/articles/{slug}.html`
- `pnpm typecheck` が通る
- TUI mock が起動する
- Keystatic（local）で 36 docs + 4 web-clips が見える
- `ingest-articles.yml` が main の `content/` push で TTS を撃たない
- RSS / 既存音声 URL が変わらない

### 4.6 この PR でやらない

- `POST /api/capture`
- ingest Edge Function の `content_path`
- Next.js の記事公開ページ
- Markdoc パーサを Pages に掛ける
- inbox 4 本の `podcast: queued`
- Cloudflare Access（Vercel の GitHub OAuth で編集は既に守られている。Capture 公開時に再検討）

---

## 5. Phase 2 — Capture（完了 #87）

知識を Git に置く HTTP 入口。TTS は呼ばない。

- 実装: `apps/web/app/api/capture/route.ts`
- `POST /api/capture` + `Authorization: Bearer <CAPTURE_API_TOKEN>`（constant-time 比較）
- `PATCH /api/capture` で `podcast` フラグだけ更新（ingest は呼ばない）
- 本番は Octokit で `main` に Direct Commit。開発時は FS 直書き
- 既定は `content/web-clips/{YYYY-MM-DD}-{slug}/index.mdoc`、`podcast: none`
- CLI `pnpm capture --title ... --file ...`
- レスポンスは commit SHA と path。GitHub API が遅いときは 202 + 再送可能
- 運用・env・ブランチ保護: [apps/web/README.md](../../apps/web/README.md)
- Mac / iPhone からの使い方: [capture-clients.md](../guides/capture-clients.md)（iOS はショートカット推奨。Web Clip 用 UI `/clip` は任意の後追い）

Chrome 拡張・最小 Web UI は後追い可。curl / CLI / ショートカット / スキルで FR-02 を満たす。

---

## 6. Phase 3 — ポッドキャスト入力を Git に切替（完了 #88）

実行グラフは変えない。ingest の入力とトリガーを Git 正本に合わせた。

- migration: `articles.content_path` / `content_sha`（UNIQUE）。episodes には足さない
- ingest は既存 `{ title, content }` を維持し、任意で `content_path` 等を受け取る。UNIQUE 衝突は **409**
- Git 正本は `.mdoc`。パイプラインへ渡す前に frontmatter 除去 + 既知タグの textify
- Actions: `podcast: queued` を検知 → ingest → **同じ job が `published` + `contentSha` を書き戻す**
- `podcast-research` は mdoc を書いて PR。queued は明示
- 移行済み web-clips 4 本は **queued にしない**（黙って TTS しない）

mem 必須パス（`ingest-mem-note.yml`）は残してよい。本線ではない。

---

## 7. Phase 4 — 公開サイト（完了 #90, #94）

- Next.js が記事一覧・詳細・プレイヤーを描画（`/` と `/articles/[slug]`）
- GitHub Pages ワークフローは旧 URL の meta-refresh リダイレクトだけ出す（`NEXT_PUBLIC_SITE_URL`）
- `web/template.html` / `scripts/build-web.ts` は `archive/` へ
- `/keystatic` は非公開のまま（GitHub OAuth。必要なら Basic Auth 追加）
- `web-clips` は一覧に出さない

---

## 8. Phase 5 — MCP

`apps/mcp`（FastMCP）。Cloud Agent は repo checkout なしで知識に触れる。

- `search_docs` / `get_doc` … 読み取り専用トークンまたは checkout 済み専用
- `write_clip` / `queue_podcast` … Capture / 内部 API。書き込み用 `GITHUB_TOKEN` を MCP に渡さない
- `queue_podcast` は Capture の更新（PATCH 相当）が先

---

## 9. Phase 6 — 掃除

- mem 必須パス、旧 inbox CI、`MEM_API_KEY` の本線利用を削除
- `mem_note_id` 列は履歴として残してよい

---

## 10. エージェント向けの切り方

次の実装単位の目安:

`feat: FastMCP knowledge tools (Phase 5)`

Capture / 公開サイト / Git ingest は完了済み。設計の解釈で迷ったら [pkm-migration.md](./pkm-migration.md) を優先する。この計画と食い違う新判断が必要なら、コードより先に設計 PR を出す。
