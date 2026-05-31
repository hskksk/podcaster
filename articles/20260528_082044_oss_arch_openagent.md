# OSSアーキテクチャ深掘りシリーズ: OpenAgent のアーキテクチャと設計思想

## 1. 概要とプロジェクトのビジョン

**OpenAgent**（[the-open-agent/openagent](https://github.com/the-open-agent/openagent)）は、LLM・RAG・エージェントループを統合した **セルフホスト型パーソナル AI アシスタント** プラットフォームである。Casbin / Casdoor エコシステム（Casdoor 認証、Casbin 認可）と密接に連携し、単一バイナリで配布される「全部入り」設計が特徴である。

調査時点（2026年5月）の規模感: GitHub スター約 5,000、主要言語 Go、ライセンス Apache 2.0、デフォルトブランチ `master`。2020年5月にリポジトリ作成され、Casibase 系の知識基盤・AI 統合プラットフォームから進化した系譜を持つ。

### 解決する課題

個人や組織が AI アシスタントを本番運用する際、以下の課題が散在する。

- **LLM プロバイダの多様性**: OpenAI / Claude / Gemini / DeepSeek / Ollama など、用途ごとに API 統合を自前実装する必要がある
- **RAG 基盤の構築**: ドキュメント取り込み・チャンク分割・埋め込み・ベクトル検索を一から組む必要がある
- **エージェント実行環境**: ブラウザ操作、シェル実行、Office 自動化、MCP ツール連携を安全に統合する必要がある
- **運用・監査**: マルチテナント、SSO、利用量課金、監査ログを別途構築する必要がある

OpenAgent はこれらを **1つの Go バイナリ + React 管理 UI** に集約する。README では「next-generation personal AI assistant powered by LLM, RAG and agent loops — ships as a single binary, no installation needed」と位置づけられている。

### ターゲットユーザー

- 自社ドキュメントを RAG 化して社内 AI アシスタントを立てたいチーム
- 複数 LLM を切り替えながら browser-use / shell / MCP ツールを使うパワーユーザー
- Casdoor / Casbin ベースの認証・認可基盤を既に持つ組織
- エンタープライズ向けに利用量・コスト・監査ログを可視化したい管理者

### 設計上の核心思想

| 原則 | 内容 |
|------|------|
| **Single Binary First** | フロントエンドを Go バイナリに embed し、依存ランタイムなしで即起動 |
| **Store as Brain** | `Store` エンティティがモデル・プロンプト・RAG・ツール・MCP を束ねる設定ハブ |
| **Provider Abstraction** | LLM / Embedding / TTS / STT / Storage を Factory パターンで差し替え可能 |
| **Transparent Agent Loop** | ツール呼び出し・引数・結果を UI 上で段階的に可視化 |
| **Platform, not Plugin** | OpenCode 向けプラグインではなく、フルスタック SaaS 相当の自己ホスト基盤 |

---

## 2. システムアーキテクチャ

### 全体像：Go バックエンド + React フロントエンド

OpenAgent は **Beego MVC** バックエンドと **React 18 SPA** フロントエンドのデカップル構成である。永続化は **XORM** 経由で MySQL / PostgreSQL / SQLite（MySQL 不在時は `openagent.db` にフォールバック）をサポートする。

```
┌─────────────────────────────────────────────────────────────────────┐
│                     React Frontend (web/)                            │
│  ChatPage · ManagementPage · ProviderEdit · FileTree · BPMN Editor  │
│  Ant Design 6 + @ant-design/x + bpmn-js + Casdoor JS SDK            │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ REST API / SSE
┌───────────────────────────────▼─────────────────────────────────────┐
│                   Beego Filter Pipeline (main.go)                    │
│  CorsFilter → AutoSigninFilter → StaticFilter → AuthzFilter         │
│  → PrometheusFilter → RecordMessage                                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│              controllers/ (ApiController)                            │
│  message_answer.go · provider.go · file.go · server.go · store.go   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
   object/ (Domain)        model/ (LLM)           tool/ + mcp/
   Store, Message,         Provider Factory       Built-in + MCP
   Vector, Chat, Tool      OpenAI, Claude,        Tool Loop
                           Gemini, Ollama...
        │
        ▼
   XORM Adapter → MySQL / SQLite / Postgres
        │
        ▼
   External: Casdoor (Auth) · LLM APIs · MCP Servers · Chrome/chromedp
```

### 起動シーケンス

`main.go` は以下の順序で初期化する。

1. **CLI Early Dispatch** — サブコマンド処理
2. **DB Adapter** — MySQL 接続試行、失敗時 SQLite フォールバック
3. **CreateTables + InitDb** — 組み込み Provider / Store / Tool / Skill のシード
4. **ユーティリティ** — GeoIP DB、ドキュメントパーサ
5. **バックグラウンドワーカー** — チャットクリーンアップ、メッセージトランザクションリトライ、Store カウント更新
6. **Beego Filter 注入 + Run** — デフォルトポート 14000

### 主要サブシステム

| サブシステム | 責務 | 主要コード |
|:---|:---|:---|
| **Identity** | Casdoor SSO、JWT 自動サインイン、RBAC | `routers/auto_signin_filter.go`, `authz/` |
| **Connectors** | LLM / Embedding / MCP / Tool 管理 | `model/provider.go`, `object/provider.go`, `mcp/` |
| **Knowledge Base** | RAG パイプライン | `object/vector_embedding.go`, `object/search*.go` |
| **Core Chat** | SSE ストリーミング、エージェントループ | `controllers/message_answer.go` |
| **Agent Tools** | 組み込み + MCP ツール実行 | `tool/`, `object/merge_agent_tools.go` |
| **Workflow** | BPMN ベースの自動化 | `bpmn/`, `pipe/` |
| **Infra** | マシン・コンテナ・K8s 管理 | `object/` 配下のインフラエンティティ |
| **Observability** | Prometheus、監査ログ、利用量分析 | `routers/` filters, `object/usage` 系 |

### チャット・メッセージパイプライン

ユーザーがメッセージを送信すると、以下のライフサイクルが走る。

```
User Input
  → POST /api/add-message (ユーザー + AI プレースホルダ作成)
  → GET /api/get-message-answer (SSE)
      ├─ ResolveStoreForChat() — Store 設定解決
      ├─ validateTransactionBeforeAIGeneration() — 課金 dry-run
      ├─ GetNearestKnowledge() — RAG ベクトル検索
      ├─ MergeMcpTools() — MCP + 組み込みツール統合
      ├─ QueryTextWithTools() — LLM + ツールループ
      └─ SSE チャンク → Carrier パース → UI 描画
```

**Store** はこのパイプラインの「脳」である。`modelProvider`、`prompt`、`vectorStores`、`tools`、`skills` を束ね、チャットセッションごとの AI 振る舞いを決定する。

### RAG パイプライン

1. **Storage** — ローカル FS / OSS / Casdoor 等の `StorageProvider` にファイル保存
2. **Parsing** — `txt.GetParsedTextFromUrl` で PDF / DOCX / MD 等をテキスト化
3. **Splitting** — Default / QA / Markdown 戦略でチャンク分割
4. **Embedding** — `EmbeddingProvider` でベクトル化
5. **Indexing** — `object.Vector` として DB 永続化
6. **Retrieval** — `DefaultSearchProvider`（コサイン類似度）または `HierarchySearchProvider`（LLM による質問拡張）

### エージェントツール & MCP

ツール実行は **統一 `Tool` インターフェース** と **セッションベースの実行ループ** で管理される。

**組み込みツール（`tool.New` ファクトリ）:**

| タイプ | 機能 |
|:---|:---|
| `web_search` | DuckDuckGo / Google / Bing / Baidu |
| `web_fetch` | HTML 取得・テキスト抽出 |
| `web_browser` | chromedp ヘッドレス Chrome |
| `browser_use` | 可視 Chromium + 座標クリック・スナップショット |
| `shell` | PTY 対応シェル実行（セッション ID 付き） |
| `office` | Word / Excel / PowerPoint 読み書き |
| `gui` | Windows UIA 自動化 |
| `video_download` | yt-dlp ベースの動画・音声取得 |

**MCP 統合:**

- `object.Server` エンティティで URL / Token / ツールキャッシュを管理
- `mcp.GetToolsFromURL` で StreamableHTTP トランスポート経由のツール発見
- `BuildMcpToolSet` で `serverName__toolName` 形式の名前空間付け
- イントラネット MCP スキャン（CIDR プローブ、32 並列ワーカー）
- 公開レジストリ（`mcp.casdoor.org`）からワンクリック追加

### Browser & Computer-Use

`browser_use` ツールは `browserUseManager` によるセッション永続化（Cookie / LocalStorage）を持つ。Chrome DevTools Protocol（chromedp）で navigate / snapshot / click / type を実行する。

フロントエンド側では `OsDesktop` コンポーネントが **Web 上のデスクトップ OS シミュレーション** を提供し、Guacamole トンネル経由で VNC/RDP リモートデスクトップを表示する。Vision モデルと組み合わせた computer-use シナリオを想定した設計である。

### 設定の階層構造

```
Environment Variables  >  conf/app.conf  >  Hardcoded Defaults
```

フロントエンド設定（Casdoor issuer / clientId 等）は `routers/static_filter.go` が JS バンドルに **ランタイム注入** する。ビルド時固定ではなく、デプロイ環境ごとに `app.conf` だけ差し替え可能。

---

## 3. 設計思想と開発の原則

### Store-Centric Configuration

OpenAgent の中核概念は **Store（AI 設定ユニット）** である。1 Store = 1 AI アシスタントの「人格 + 能力セット」。

- モデルプロバイダ（LLM / Embedding / TTS）
- システムプロンプト
- 接続 Knowledge Base（VectorStore）
- 有効ツール一覧（Built-in + MCP）
- Skills（プロンプト断片のモジュール）

チャット（`object.Chat`）は Store に紐づき、メッセージ（`object.Message`）はチャット内の会話単位となる。この 3 層（Store → Chat → Message）が全 AI 機能の軸である。

### Provider Factory Pattern

`model/provider.go` の `GetModelProvider` が OpenAI / Azure / Claude / Gemini / Ollama 等 30+ プロバイダを型文字列で解決する。Embedding / TTS / STT / Storage も同様の Factory パターンで、**新プロバイダ追加は `model/` または各 `*/provider.go` に実装を足す** だけで済む設計である。CONTRIBUTING.md でも「New AI providers — integrate a new model provider in `model/`」と明記されている。

### 透明性のあるエージェントループ

OpenAgent はツール呼び出しを UI 上で段階表示する（`MessageItem` の `ToolCallSection`、Reasoning Phase の collapsible panel）。「ブラックボックスで答えが返る」ChatGPT 型 UI ではなく、**各ステップの tool name / arguments / result を監査可能** にする思想が README の "Transparent Tool Calls" にも表れている。

### マルチテナント & エンタープライズ志向

Casdoor 連携による Organization 単位の分離、RBAC（`AuthzFilter`）、利用量トラッキング（トークン単価 × 消費量）、監査ログ（`RecordMessage` filter）を標準装備する。デモモード（`isDemoMode`）で公開デモを read-only 運用できる。

### ワークフロー自動化（BPMN）

`bpmn-js` + Camunda moddle による **ビジュアルワークフロービルダー** を内蔵。条件分岐・並列実行・スケジューリングを BPMN 2.0 標準で記述できる。単純なチャットボットを超え、**業務プロセス自動化プラットフォーム** としての側面を持つ。

### Carrier パターン

ストリーミング応答中に `<title>` や suggestion タグを埋め込む **Carrier** 機構（`carrier/` パッケージ）がある。LLM 出力を構造化メタデータ + Markdown 本文に分離し、フロントエンドの `MessageCarrier.js` でリアルタイムパースする。タイトル自動生成やフォローアップ提案をストリーム内で完結させる設計である。

---

## 4. プロジェクト構造とコーディング規約

### トップレベルディレクトリ

```
openagent/
├── main.go              # エントリポイント
├── conf/                # app.conf + 設定ヘルパ
├── controllers/         # Beego API コントローラ（REST エンドポイント）
├── object/              # ドメインロジック・XORM モデル（最大のパッケージ）
├── model/               # LLM プロバイダ実装
├── embedding/           # 埋め込みプロバイダ
├── tts/                 # Text-to-Speech
├── tool/                # 組み込みエージェントツール
├── mcp/                 # MCP クライアント
├── storage/             # ファイルストレージ抽象化
├── carrier/             # ストリーム Carrier パーサ
├── chain/               # LLM チェーン処理
├── bpmn/                # ワークフロー
├── pipe/                # パイプライン
├── auth/ authz/          # 認証・認可
├── routers/             # ルーティング + Filter
├── web/                 # React フロントエンド
├── skills/              # 組み込み Skill 定義
├── scripts/             # install.sh / install.ps1
├── deploy/              # デプロイ設定
└── internal/cli/        # CLI サブコマンド
```

### バックエンド規約

- **MVC 分離**: `controllers/` は HTTP 入出力、`object/` はビジネスロジック、`model/` は外部 AI API ラッパ
- **XORM モデル**: `object/*.go` に struct 定義 + CRUD。RLS 相当は `AuthzFilter` + Organization スコープで実現
- **命名**: REST エンドポイントは `/api/get-*`, `/api/add-*`, `/api/update-*`, `/api/delete-*` の CRUD 規約
- **Go バージョン**: go 1.25.0（toolchain go1.25.8）

### フロントエンド規約

- **React 18 + Ant Design 6** — 管理 UI の基盤
- **@ant-design/x** — AI チャット UI（Sender コンポーネント等）
- **Backend JS レイヤ**: `web/src/backend/*Backend.js` が API 呼び出しを抽象化（例: `MessageBackend.js`, `StoreBackend.js`）
- **i18n**: `web/src/locales/en/data.json`, `zh/data.json` — 日英中対応
- **パッケージマネージャ**: Yarn 必須（`preinstall` フックで npm 使用を拒否）
- **CRACO**: Create React App のカスタマイズ（Less サポート）

### フロントエンド API クライアント層

各エンティティに対応する `*Backend.js` + `*ListPage.js` / `*EditPage.js` のペアが存在する。`BaseListPage` を継承した一覧 + 編集フォームという **Casdoor / Casibase 系の定型 UI パターン** が一貫して使われている。

---

## 5. 品質保証と導入ツール

### CI/CD パイプライン（`.github/workflows/build.yml`）

| ジョブ | 内容 |
|:---|:---|
| **go-tests** | MySQL 5.7 サービスコンテナ上で `go test -v`（`-tags skipCi`） |
| **frontend** | Node 22 + Yarn build（`CI=false`） |
| **backend** | `go build -race -ldflags "-extldflags '-static'"` |
| **linter** | golangci-lint v2.11.4（gofumpt のみ有効） |
| **tag-release** | semantic-release による自動タグ付け |
| **github-release** | GoReleaser + UPX 圧縮バイナリ配布 |

### 静的解析

- **golangci-lint**: default linters 無効、gofumpt formatter のみ有効（`.golangci.yml`）
- **Go Report Card**: README バッジで公開

### テスト戦略

- バックエンド: `go test` が CI のゲート。MySQL 依存テストは GitHub Actions サービスで実行
- フロントエンド: `ChatMessageRender.test.js` 等の Jest テストが存在するが、CI では build のみ（test ジョブなし）
- `-tags skipCi` で CI 非対応テストを除外

### リリース

- **GoReleaser**（`.goreleaser.yaml`）: linux/amd64, linux/arm64, linux/riscv64 向けクロスコンパイル
- **UPX 圧縮**: サポートプラットフォームのバイナリサイズ削減
- **semantic-release**（`.releaserc.json`）: Conventional Commits ベースの自動バージョニング
- **Docker**: `casbin/openagent` イメージ（Alpine 標準 + Debian all-in-one with MariaDB）

### 開発環境

| ツール | バージョン |
|:---|:---|
| Go | 1.23.6+（go.mod は 1.25.0） |
| Node.js | 20+（CI は 22） |
| Yarn | 1.x |
| MySQL | 8.0+ / MariaDB |
| Auth | Casdoor（Docker: `casbin/casdoor-all-in-one`） |

---

## 6. まとめと学び

OpenAgent は **「AI チャット + RAG + エージェント + エンタープライズ運用」** を単一プロダクトに統合した、Casbin エコシステム最大級のフルスタック AI プラットフォームである。

### 学べるベストプラクティス

1. **Store-Centric AI Configuration** — モデル・RAG・ツール・プロンプトを 1 エンティティに束ね、チャットセッションに注入するパターンは、マルチテナント AI SaaS の設計テンプレートになる
2. **Provider Factory の徹底** — LLM / Embedding / TTS / Storage を全て interface + factory で抽象化し、30+ プロバイダを `model/` 配下に平坦に追加する拡張性
3. **Single Binary + Runtime Config Injection** — フロントエンド embed + StaticFilter による JS 設定注入で、同一バイナリを環境ごとに Casdoor 設定だけ差し替え可能
4. **Transparent Agent Loop** — ツール呼び出しの可視化 + Carrier パターンで、ストリーム中に構造化メタデータ（タイトル・提案）を混在させる
5. **MCP as First-Class Citizen** — 組み込みツールと MCP ツールを `MergeMcpTools` で統合し、名前空間付け + 権限フラグ（`IsAllowed`）で管理する
6. **Platform Breadth** — BPMN ワークフロー、K8s 管理、セキュリティスキャン、動画分析まで含む「AI 基盤 + 業務プラットフォーム」の横展開

### oh-my-openagent との対比

| 観点 | OpenAgent | oh-my-openagent |
|:---|:---|:---|
| 位置づけ | フルスタック AI プラットフォーム | OpenCode 向けエージェントハーネス |
| 言語 | Go + React | TypeScript |
| 配布 | 単一バイナリ | npm プラグイン |
| 認証 | Casdoor SSO + RBAC | OpenCode セッション依存 |
| RAG | 内蔵（Vector Store + Embedding） | 外部 MCP / ツール経由 |
| ターゲット | 組織・個人の AI 基盤 | 開発者のコーディングエージェント |

OpenAgent は「AI インフラを自前ホストしたい」組織向け、oh-my-openagent は「既存コーディングエージェントを強化したい」開発者向けと、問題領域が明確に異なる。

---

## 参考リンク

- GitHub リポジトリ: https://github.com/the-open-agent/openagent
- 公式ドキュメント: https://www.openagentai.org
- Live Demo: https://demo.openagentai.org
- Playground: https://try.openagentai.org
- Docker Hub: https://hub.docker.com/r/casbin/openagent
- Casdoor（認証基盤）: https://casdoor.org
- MCP 公開レジストリ: https://mcp.casdoor.org
- DeepWiki: https://deepwiki.com/the-open-agent/openagent
