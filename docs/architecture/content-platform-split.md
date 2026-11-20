# コンテンツ / プラットフォーム分離設計

> 日付: 2026-11-20  
> 前提: [pkm-migration.md](./pkm-migration.md) の「知識の正 = Git」「配信の正 = Supabase」は維持する。  
> 変更点: **GitHub 上の知識ファイルは private リポに集約**し、**platform は public のまま**運用する。

この文書は移行後の **ディレクトリ構成** と **現行リポからの持ち込み元** を定義する。実装順・PR 境界は [pkm-next.md](./pkm-next.md) を更新して追随する。

---

## 1. リポジトリの役割

| リポジトリ | 可視性 | 役割 |
|------------|--------|------|
| **`hskksk/podcaster`** | **public** | 配信基盤（Supabase / Edge / pgflow）、公開サイト用 Next.js、MCP / ops、CLI・TUI、型・マイグレーション、**公開用の設計ドキュメント** |
| **`hskksk/knowledge`**（新規・名称は確定前） | **private** | 知識の **正本**（Markdoc）、Keystatic が commit する先、ポッドキャスト `podcast: queued` の検知、`ingest:queued` の書き戻し、（将来）Zenn / note 向け export |

命名: 本稿では private を **`hskksk/knowledge`** と呼ぶ。既存 **`hskksk/blog`** をベースに拡張してもよい（§6 参照）。

### 1.1 変えない原則

- 配信パイプライン（ingest → domain events → jobs → RSS）は **platform + Supabase** のまま
- ingest は **本文を POST** するだけ（Edge は Git を読まない）
- web-clips → docs の昇格は **copy + `promotedTo`**（private 側でも `git mv` で履歴を切らない運用は同じ）
- 公開サイトに載せる本文は **ビルド時にマークダウンを読む**（Vercel は platform デプロイ、本文は private をビルド時に取得）

---

## 2. private: `hskksk/knowledge` のディレクトリ構成（目標）

Keystatic・Capture・エージェントスキルが触るのは **`content/` 以下が主**。blog の下書き資産は **`draft/`** に隔離する。

```text
knowledge/                          # private
├── content/
│   ├── docs/                       # 公開 wiki（調査レポート・長文ナレッジ）
│   │   └── {slug}/
│   │       ├── index.mdoc
│   │       ├── treemap.yml         # 任意
│   │       └── section-visuals.yml # 任意
│   ├── web-clips/                  # クリップ・メモ（サイト上はゲート付き）
│   │   └── {slug}/index.mdoc
│   ├── blog/                       # 自分で書いたブログ（配信チャネル付き・新設）
│   │   └── {slug}/
│   │       ├── index.mdoc
│   │       └── *.png               # 対話形式など記事ローカル画像
│   └── keystatic-templates/        # Keystatic 新規エントリ用テンプレ
│       ├── new-wiki/
│       └── new-web-clip/
├── chugaku-juken/                  # /juken 用（家庭内・限定公開想定）
│   └── sapix/grade5-japanese-history/weeks/…
├── draft/                          # 非公開・執筆中（Keystatic コレクション外）
│   ├── blog/                       # hskksk/blog 由来
│   │   ├── ideas/                  # 旧 ideas/
│   │   ├── knowledges/             # 旧 knowledges/（調査メモの下書き）
│   │   └── articles/               # 年別 + input/（起こし・素材のみ）
│   └── ingest-queue/               # 任意: CLI 用スタッシュ（基本は frontmatter の queued のみ）
├── .agents/skills/                 # 執筆・調査スキル（content を書く側）
│   ├── podcast-research/
│   ├── web-clip-summary/
│   ├── japanese-writing/
│   └── …                           # 公開してよいスキルは platform に symlink 用コピーを残すか skills.sh で同期
├── .github/workflows/
│   ├── ingest-queued.yml           # 現 podcaster の ingest-queued を移設
│   └── distribute-blog.yml         # 将来: Zenn / note export
├── scripts/                        # content 専用の薄い層
│   └── ingest-queued.ts            # platform の実装を npm 依存 or git subtree で再利用
├── package.json                    # pnpm + tsx + ingest 用 env
├── pnpm-lock.yaml
└── README.md
```

### 2.1 `content/blog` の frontmatter（設計メモ）

wiki（`docs`）と分離し、マルチ配信メタを載せる。

```yaml
---
title: …
publishedAt: 2025-12-14
podcast: none
channels:
  site: true
  zenn: true
  note: false
distribution:
  site: live
  zenn: queued | published | skipped
  note: skipped
externalUrl:
  zenn: https://zenn.dev/…
  note: https://note.com/…
sourcePath: draft/blog/articles/2025/…   # 任意: 昇格元
---
```

---

## 3. public: `hskksk/podcaster` のディレクトリ構成（目標）

**`content/` と `chugaku-juken/` はリポジトリから除く**（private 正本）。ビルド時に **git submodule** で取り込む。

```text
podcaster/                          # public
├── .gitmodules                     # knowledge → 固定コミット SHA
├── knowledge/                      # submodule（内容は §2・ビルド・CI が checkout）
├── apps/
│   ├── web/                        # 公開サイト + Keystatic UI（storage = private repo）
│   ├── mcp/
│   └── ops/
├── packages/
│   ├── markdoc-react/
│   └── gemini-batch-tts/
├── supabase/                       # migrations, functions, flows
├── scripts/                        # CLI, TUI, deploy, ingest（ingest 本体は platform から実行可）
├── docs/                           # アーキテクチャ（このファイル含む）
├── infra/
├── services/
├── shared/
├── public/                         # サイト静的アセット（カバー等）
├── .agents/skills/                 # プラットフォーム・Supabase 系（content 非依存）
├── .github/workflows/
│   ├── deploy.yml                  # Edge / DB（従来どおり）
│   ├── lint-pr.yml
│   └── vercel-build.yml            # 任意: submodule 更新検知（プレビュー用）
├── archive/                        # 歴史的スクリプト（温存）
├── articles/                       # 空 or README のみ（レガシー URL 説明）
├── inbox/                          # 空 or README のみ
├── AGENTS.md, CLAUDE.md, README.md
├── config.toml
├── package.json
└── pnpm-workspace.yaml
```

### 3.1 ローカル開発

```bash
git clone --recurse-submodules git@github.com:hskksk/podcaster.git
# knowledge が最新なら:
cd knowledge && git checkout main && git pull && cd ..
```

環境変数（実装時）:

| 変数 | 用途 |
|------|------|
| `CONTENT_ROOT` | 既定: `$REPO_ROOT/knowledge`（submodule）。`content/` の親 |
| `KEYSTATIC_GITHUB_REPO` | 既定: `hskksk/knowledge`（Keystatic GitHub storage） |

`apps/web/lib/repo-root.ts` は **platform ルート** を返し、`content` は `path.join(CONTENT_ROOT, "content")` を読む形に変更する。

### 3.2 Vercel（platform プロジェクト）

- Root Directory: `apps/web`（現状維持）
- Build: **submodule を有効化**（Project Settings → Git → Submodules）
- Deploy Hook / production: **`knowledge` submodule のコミットを bump する PR** が platform の再ビルドを起こす（本文だけ変えたときも公開面を更新）

Keystatic は **runtime で GitHub API 経由で private に commit** する。公開 HTML は **前回デプロイ時の submodule スナップショット** なので、記事を Keystatic で保存したあとも **submodule bump または再デプロイ** が必要（現行の「ビルド時静的」と同型）。

---

## 4. 持ち込み元一覧（現行 → 移行先）

### 4.1 `hskksk/podcaster`（現在の monorepo）

| 現行パス | 移行先 | 備考 |
|----------|--------|------|
| `content/docs/**` | `knowledge/content/docs/**` | 正本移動。platform から削除 |
| `content/web-clips/**` | `knowledge/content/web-clips/**` | 同上 |
| `content/keystatic-templates/**` | `knowledge/content/keystatic-templates/**` | Keystatic 新規作成 |
| `chugaku-juken/**` | `knowledge/chugaku-juken/**` | `/juken` ビルドは submodule 経由 |
| `.github/workflows/ingest-queued.yml` | `knowledge/.github/workflows/ingest-queued.yml` | Secrets を private に複製 |
| `.agents/skills/{podcast-research,web-clip-summary,…}` | `knowledge/.agents/skills/` | 執筆系。platform には `skill-orchestration` 等の参照用を残す |
| `scripts/ingest-queued.ts` | **共有** | Phase A: platform に残し knowledge CI から checkout 実行。Phase B: npm パッケージ化 |
| `apps/web/keystatic.config.ts` | platform に残す | `githubRepo` / `path` を `hskksk/knowledge` に向ける |
| `apps/web/**`（サイト） | platform | `loadPublicDocs` 等が `CONTENT_ROOT` を参照 |
| `supabase/**`, `scripts/podcast-cli.ts`, `scripts/tui/**` | platform | 変更なし（TARGET=remote 既定） |
| `archive/**`, 空の `articles/`, `inbox/` | platform | レガシー説明のみ |
| `docs/architecture/*` | platform | 公開設計。本ファイルを正とする |

### 4.2 `hskksk/blog`（既存 private）

| 現行パス | 移行先 | 備考 |
|----------|--------|------|
| `articles/**/YYYY.md`（公開済み） | `knowledge/content/blog/{slug}/index.mdoc` | `.md` → mdoc 変換、画像は slug 配下 |
| `articles/**/input/**` | `knowledge/draft/blog/articles/…` | 公開パイプラインに混ぜない |
| `ideas/**` | `knowledge/draft/blog/ideas/**` | |
| `knowledges/**` | `knowledge/draft/blog/knowledges/**` | wiki 化したら `content/docs` へ copy-promote |
| `styles/conversation_style/**` | 各 `content/blog/{slug}/` へコピー | 相対パスを記事ローカルに |
| `scripts/new-article.sh`, LSP 設定 | `knowledge/draft/blog/` または `knowledge/scripts/` | |
| `.github/workflows/*`（blog 固有） | 統合後は廃止 or knowledge にマージ | |

**リポジトリ統合方針（推奨）**: `hskksk/blog` を **`hskksk/knowledge` にリネーム / マージ** し、上記レイアウトに再配置。二重の private を避ける。

### 4.3 Zenn / note（将来・別リポの可能性）

| 成果物 | 置き場所 |
|--------|----------|
| Zenn 用 `articles/*.md` | **`hskksk/zenn-blog` 等の既存連携 repo**（private または public は Zenn 設定に従う） |
| 生成物 | `knowledge` の CI が export commit。**正本は常に `content/blog/index.mdoc`** |

---

## 5. コンポーネントと「どのリポが所有するか」

| コンポーネント | 所有リポ | 接続 |
|----------------|----------|------|
| Keystatic 管理 UI | platform (`apps/web`) | GitHub App → **private** `content/**` に R/W |
| Capture API | platform | 同上（commit 先だけ private） |
| 公開サイト SSG | platform | ビルド時 `knowledge` submodule 読み取り |
| `ingest:queued` CI | **private** | `content/**` の `podcast: queued` → platform の Supabase ingest URL |
| Edge Functions / DB | platform + Supabase プロジェクト | 変更なし |
| podcast-research PR | **private** | マージ先 `main` が `knowledge` |
| platform 機能 PR | **public** | マージ先 `hskksk/podcaster` |
| エージェントスキル（調査執筆） | **private** が正本 | public はドキュメント・CI 用スキルのみ |

---

## 6. 移行フェーズ（PR 境界案）

```
Phase S0  本設計の合意 + knowledge リポ作成（空の content/ 骨格）
Phase S1  git filter-repo / git mv で podcaster の content + chugaku-juken を knowledge へ
Phase S2  platform に submodule 追加、CONTENT_ROOT / Keystatic repo 向け先、Vercel submodule
Phase S3  ingest-queued.yml を knowledge へ移設 + Secrets 複製
Phase S4  blog → content/blog + draft/ 再配置（別 PR 可）
Phase S5  blog frontmatter（channels）+ distribute workflow（Zenn から）
```

S1 と S2 は **同じメンテナンスウィンドウ** で行うと、公開サイトが一時的に空になる時間を最短にできる。

---

## 7. 未決定事項（確定すると実装に入れる）

1. private リポ名: `knowledge` 新設 vs `blog` 拡張リネーム  
2. `chugaku-juken` を `/juken` で公開し続けるか（private のまま submodule で十分か）  
3. web-clips を production で GitHub OAuth ゲートするか（現状 middleware のままか）  
4. ingest スクリプト共有: submodule 内に vendored copy vs `@podcaster/ingest-cli` パッケージ

---

## 8. 関連ドキュメント

- [pkm-migration.md](./pkm-migration.md) — 2 コレクション + podcast frontmatter（blog は §2.1 で拡張）
- [pkm-next.md](./pkm-next.md) — 実装フェーズ（S0–S5 を追記予定）
- [apps/web/README.md](../../apps/web/README.md) — Vercel / Keystatic（submodule 前提に更新予定）