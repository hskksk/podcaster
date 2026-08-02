# AIエージェント Skills 共有 Registry/Hub OSS エコシステム調査

## 概要

2025年後半から2026年にかけて、AIコーディングエージェント（Claude Code、Cursor、OpenClaw、Codex など）向けに「Skills（スキル）」を共有・配布する Registry/Hub エコシステムが急速に形成されている。Skills は `SKILL.md` という Markdown ファイルを核としたフォルダ単位の能力拡張パッケージであり、npm が JavaScript パッケージを配布したように、エージェントの「知識・手順・ツール連携」を配布する仕組みとして位置づけられている。

本レポートでは、**実際に使われている主要な OSS・サービス**に焦点を当て、特に最近注目を集めている **ClawHub** とその互換エコシステムを中心に整理する。スター数が極端に少なく実利用が見込めないプロジェクトは除外し、エコシステムの「規格層」「公開 Registry 層」「集約・発見層」「セルフホスト層」の4層構造で理解する。

なぜ今この話題が重要か。Skills はエージェントに「何をどう実行するか」を教える**実行可能な指示書**であり、MCP（Model Context Protocol）がツール接続の標準化を担うのに対し、Skills は**手順・判断基準・ワークフロー**の標準化を担う。2026年2月には ClawHub で大規模なサプライチェーン攻撃（ClawHavoc）が発覚し、Registry のセキュリティモデル自体が議論の中心になった。開発者にとって「どの Hub を使うか」は、単なるパッケージマネージャ選びではなく、**信頼・検証・更新・権限**の設計選択でもある。

---

## 背景・歴史

### Skills 概念の誕生（2025年）

Anthropic は 2025年10月に Claude 向け Skills 機能を発表した。Skills は「エージェントが特定タスクを繰り返し実行するための指示・スクリプト・リソースの束」として設計され、プロンプトを都度書く代わりに、検証済みワークフローを再利用できるようにするものだった。

### Agent Skills オープン規格（2025年12月）

2025年12月18日、Anthropic は Agent Skills 仕様を **agentskills.io** として公開した。Claude だけでなく Cursor、GitHub Copilot、VS Code、Codex、OpenCode など40以上のクライアントが対応を表明し、OpenAI も構造的に同一のアーキテクチャを採用した。GitHub 上の `agentskills/agentskills` リポジトリ（約2.4万スター）は仕様書・検証ツール（skills-ref）・クライアント実装ガイドを提供する**規格の参照実装**であり、Registry そのものではない。

### Registry エコシステムの爆発（2026年1月〜）

2026年1月、Vercel Labs が `npx skills` CLI と **skills.sh** ディレクトリを公開。同月後半、OpenClaw（旧 Clawdbot）が GitHub で爆発的にスターを獲得し、公式 Registry として **ClawHub**（clawhub.ai）が前面に出た。ClawHub は「AI エージェント向け npm」と称され、3000〜5000件以上の Skills をホストする最大級の公開 Registry となった。

並行して、GitHub 上の `SKILL.md` を横断インデックスする **SkillsMP**（200万件超のスキルを収集・検索）や、Claude Code 向け **Plugin Marketplace**（`.claude-plugin/marketplace.json` 形式）など、複数の「発見・配布」レイヤーが共存する状況になった。

### セキュリティインシデント（2026年2月）

2026年2月1日、Koi Security が ClawHub 全スキルの監査を実施し、2857件中341件が悪意あるスキルであると報告。これが **ClawHavoc** キャンペーンとして知られる。後続調査では歴史的に1184件以上の悪意あるスキルが ClawHub に存在したとされ、Atomic macOS Stealer（AMOS）などのペイロード、プロンプトインジェクション、API キー窃取が確認された。Registry エコシステム全体に「オープン Registry の信頼モデルはどうあるべきか」という問いが投げかけられた。

---

## 核となる概念

### Agent Skills 規格（agentskills.io）

Agent Skills の最小単位は **`SKILL.md` を含むディレクトリ**である。

```
my-skill/
├── SKILL.md          # 必須: YAML frontmatter + Markdown 本文
├── scripts/          # 任意: 実行可能コード
├── references/       # 任意: 参照ドキュメント
└── assets/           # 任意: テンプレート等
```

**必須 frontmatter フィールド:**

| フィールド | 制約 |
|-----------|------|
| `name` | 1〜64文字、小文字・数字・ハイフンのみ。親ディレクトリ名と一致 |
| `description` | 1〜1024文字。何をするか＋いつ使うかを記述 |

**任意 frontmatter:** `license`, `compatibility`, `metadata`, `allowed-tools`（実験的）

**Progressive Disclosure（段階的開示）** という設計原則がある:

1. **Discovery**: 起動時に全スキルの `name` + `description` のみロード（各約100トークン）
2. **Activation**: タスクがマッチしたら `SKILL.md` 全文をロード
3. **Execution**: 必要に応じて `scripts/` や `references/` を読み込み・実行

これにより、多数のスキルを「常時コンテキストに載せずに」利用できる。

### Registry / Hub / Marketplace / Aggregator の違い

| 種類 | 役割 | 例 |
|------|------|-----|
| **規格（Spec）** | フォーマット定義。配布機能なし | agentskills.io |
| **Registry/Hub** | スキルの publish/install/version/search を提供 | ClawHub, skills.sh |
| **Marketplace** | プラグインカタログ（skills + commands + hooks 等） | Claude Code Plugin Marketplace |
| **Aggregator** | 既存ソース（主に GitHub）を横断インデックス | SkillsMP |
| **Curated Collection** | 厳選リスト。Registry ではない | anthropics/skills, awesome-openclaw-skills |

「ClawHub 互換」とは、ClawHub の **REST API / CLI プロトコル**（OpenAPI v1）を実装し、`clawhub install` や `CLAWHUB_REGISTRY` 環境変数で差し替え可能なセルフホスト Registry を指す。

---

## ClawHub とは何か

### 位置づけ

**ClawHub**（https://clawhub.ai）は、OpenClaw エコシステムの**公式公開 Skills Registry**である。OpenClaw 本体（`openclaw/openclaw`、約38万 GitHub スター）は個人用 AI アシスタントの Gateway/Agent フレームワークであり、ClawHub はその Skills を「App Store のように」配布する層に相当する。

ClawHub プラットフォーム自体の OSS 実装は `openclaw/clawhub`（約9200 GitHub スター、MIT、TypeScript）で公開されている。Skills だけでなく、2026年時点では **Code Plugins** と **Bundle Plugins** のカタログ機能も追加されている。

### 何ができるか

**ユーザー（インストール側）:**
- Web UI（clawhub.ai）でスキルを閲覧・検索
- `openclaw skills search/install/update` または `clawhub install` でローカルにインストール
- セマンティックバージョン管理、changelog、タグ（`latest` 等）
- スター・コメント・ダウンロード数による発見
- セキュリティスキャン結果の公開表示

**開発者（公開側）:**
- `SKILL.md` を含むフォルダを publish
- semver でバージョン管理
- slug による命名（`@owner/skill-name` 形式）
- GitHub アカウント連携（公開には1週間以上の GitHub アカウントが必要）

**CLI 例:**

```bash
# 検索・インストール（OpenClaw ネイティブ）
openclaw skills search "git workflow"
openclaw skills install @openclaw/demo

# Registry 認証・公開（ClawHub CLI）
clawhub login
clawhub skill publish ./my-skill --slug my-skill --version 1.0.0
clawhub install @openclaw/demo
clawhub update --all
```

デフォルトでは `./skills`（または OpenClaw workspace の `skills/`）にインストールされ、`.clawhub/lock.json` でバージョンが記録される。

### ClawHub の Skill フォーマット（Agent Skills との関係）

ClawHub は **Agent Skills 規格（SKILL.md + frontmatter）をベース**にしつつ、OpenClaw 固有の拡張メタデータ `metadata.openclaw` を持つ。

```yaml
---
name: todoist-cli
description: Manage Todoist tasks from the command line.
version: 1.2.0
metadata:
  openclaw:
    requires:
      env:
        - TODOIST_API_KEY
      bins:
        - curl
    primaryEnv: TODOIST_API_KEY
    install:
      - kind: brew
        formula: jq
        bins: [jq]
---
```

`metadata.openclaw` で宣言できる主な項目:
- `requires.env` / `requires.bins` / `requires.anyBins` / `requires.config`
- `primaryEnv`, `envVars`, `always`, `skillKey`, `emoji`, `homepage`, `os`
- `install`（brew/node/go/uv による依存インストール指定）

ClawHub は publish 時にメタデータと実コードの整合性をセキュリティ分析し、不整合をフラグする。公開スキルは **MIT-0** ライセンスが適用される（ClawHub 上での再配布条件）。

**制限:**
- バンドルサイズ上限 50MB
- ベクトル検索用 embedding テキストは SKILL.md + 最大約40ファイル

### ClawHub の API・プロトコル

ClawHub は **CLI フレンドリーな REST API** を提供する。公開 API 例（clawhub.ai 上のスキルが提供）:

- `GET /api/top-stars?limit=N` — スター数順ランキング
- `GET /api/top-downloads?limit=N` — ダウンロード数順
- `GET /api/newest` — 新着スキル
- `GET /api/search?q=...` — 検索
- `GET /api/certified` — セキュリティ認証済み
- `GET /api/stats` — 統計

検索は **embedding ベースのベクトル検索**（キーワードだけでなく意味的類似性）を採用している点が特徴。

セルフホスト Registry は **ClawHub OpenAPI v1 互換**を標榜するものが多い。CLI 側は `CLAWHUB_REGISTRY=https://your-registry.example.com` または `--registry` フラグで切り替え可能。

### ClawHub と OpenClaw の関係図

```
┌─────────────────┐     publish/search/install     ┌──────────────────┐
│  開発者          │ ─────────────────────────────► │  ClawHub         │
│  (SKILL.md)     │                                │  clawhub.ai      │
└─────────────────┘                                │  openclaw/clawhub│
                                                   └────────┬─────────┘
                                                            │ download
                                                            ▼
┌─────────────────┐     skills load at runtime    ┌──────────────────┐
│  Messaging      │ ◄──────────────────────────── │  OpenClaw        │
│  WhatsApp/Slack │                               │  Gateway + Agent │
│  Telegram 等    │                               │  openclaw/openclaw│
└─────────────────┘                               └──────────────────┘
```

---

## 主要 OSS・サービス比較

### 1. ClawHub（openclaw/clawhub）— OpenClaw 公式 Registry

| 項目 | 内容 |
|------|------|
| GitHub Stars | 約9,200 |
| ライセンス | MIT |
| ホスト | clawhub.ai（SaaS）+ セルフホスト可能な OSS |
| カタログ規模 | 3,000〜5,000+ スキル（2026年前半） |
| インストール | `clawhub` / `openclaw skills` CLI |
| 検索 | ベクトル検索（embedding） |
| 特徴 | OpenClaw エコシステムの中心。Plugin カタログも統合。モデレーション・セキュリティスキャン |
| 弱点 | 2026年2月 ClawHavoc インシデント。オープン publish モデルのセキュリティリスク |

### 2. skills.sh / vercel-labs/skills — クロスエージェント CLI + ディレクトリ

| 項目 | 内容 |
|------|------|
| GitHub Stars | 約27,800 |
| ライセンス | MIT |
| ホスト | skills.sh（リーダーボード） |
| カタログ規模 | 69,000+ スキル追跡、200万 CLI インストール（2026年2月時点） |
| インストール | `npx skills add owner/repo` |
| 対応エージェント | 70+（Claude Code, Cursor, Codex, OpenCode, Copilot 等） |
| 特徴 | **GitHub をソースとする npm 型パッケージマネージャ**。Registry サーバー不要。インストール数テレメトリでリーダーボード |
| 弱点 | 中央 Registry ではなく GitHub 依存。セキュリティレビューは利用者側 |

```bash
npx skills add vercel-labs/agent-skills
npx skills add addyosmani/agent-skills --skill test-driven-development
npx skills find "react performance"
npx skills list
npx skills update
```

Agent Skills 規格に準拠したスキルを、エージェントごとのディレクトリ（`.cursor/skills/`, `~/.claude/skills/` 等）へ自動配置する。

### 3. SkillsMP（skillsmp.com）— 大規模 Aggregator

| 項目 | 内容 |
|------|------|
| OSS | なし（Web サービス + 無料 API） |
| カタログ規模 | 200万+ SKILL.md（GitHub 横断収集） |
| 検索 | キーワード + AI セマンティック検索 |
| API/MCP | REST API、MCP Server 提供 |
| 特徴 | **最大級の発見レイヤー**。職種・カテゴリ分類。Anthropic/OpenAI 非公式 |
| 弱点 | スクレイピングベースで curation なし。インストール前の監査必須 |

CLI 連携: `masonc15/skillsmp`（ターミナル検索）、`gccszs/skillsmp-searcher`（Claude Code スキルとして検索・インストール支援）。

### 4. agentskills/agentskills — オープン規格リポジトリ

| 項目 | 内容 |
|------|------|
| GitHub Stars | 約23,700 |
| 役割 | 仕様書、skills-ref 検証 CLI、クライアント実装ガイド |
| 特徴 | **エコシステムの「憲法」**。Registry 機能は持たない |
| 検証 | `skills-ref validate ./path-to-skill` |

### 5. anthropics/skills — 公式リファレンスコレクション

| 項目 | 内容 |
|------|------|
| GitHub Stars | 約165,700 |
| 役割 | Anthropic 公式スキル例（docx/pdf/pptx/xlsx 等は source-available） |
| 特徴 | 規格の「お手本」。Claude 組み込みディレクトリの参照元 |
| インストール | Claude Code 公式、または `npx skills add anthropics/skills` |

### 6. Claude Code Plugin Marketplace — プラグインカタログ規格

Claude Code は **Plugin Marketplace** という別レイヤーを持つ。`.claude-plugin/marketplace.json` がカタログ定義。

```bash
/plugin marketplace add anthropics/claude-plugins-official
/plugin install example-skills@anthropic-agent-skills
```

| 項目 | 内容 |
|------|------|
| 公式 | `anthropics/claude-plugins-official`（Anthropic キュレーション） |
| コミュニティ | `anthropics/claude-plugins-community`（自動検証 + 安全スクリーニング） |
| 第三者 | claudemarketplaces.com に2500+ marketplace 登録（2026年） |
| 特徴 | skills + commands + hooks + MCP を束ねた**プラグインパッケージ** |
| Skills 連携 | marketplace.json の `plugins` 配列に `source` で SKILL.md ディレクトリを指定可能 |

Agent Skills 規格の `SKILL.md` と Claude Plugin Marketplace は**相互運用可能**だが、カタログ形式は異なる。Addy Osmani の `agent-skills` は両方に対応（`npx skills add` と `/plugin marketplace add`）。

### 7. iflytek/skillhub — エンタープライズ向けセルフホスト Registry

| 項目 | 内容 |
|------|------|
| GitHub Stars | 約4,800 |
| ライセンス | Apache-2.0 |
| 技術 | Java 21 + React 19、Docker/K8s |
| 特徴 | **ClawHub 互換レイヤー** + RBAC + 監査ログ + Skill Scanner + 命名空間 |
| 用途 | 社内 Skills の private Registry。`CLAWHUB_REGISTRY` で CLI 接続 |
| 弱点 | ClawHub プロトコル互換は「拡大中」と明記。ベクトル検索は FTS |

```bash
export CLAWHUB_REGISTRY=https://skillhub.your-company.com
clawhub login --token YOUR_API_TOKEN
clawhub search email
clawhub publish ./my-skill --slug my-team--my-skill --version 1.0.0
```

### 8. VoltAgent/awesome-openclaw-skills — ClawHub キュレーション

| 項目 | 内容 |
|------|------|
| GitHub Stars | 約51,700 |
| 役割 | ClawHub 上の5300+ スキルからスパム・重複・悪意あるものを除外した awesome list |
| 特徴 | ClawHub の「人間によるフィルタリング層」。Registry ではない |
| サイト | clawskills.sh |

### 9. addyosmani/agent-skills — 高品質キュレーションコレクション

| 項目 | 内容 |
|------|------|
| GitHub Stars | 約81,300 |
| スキル数 | 24（SDLC 全体をカバー） |
| 特徴 | TDD、セキュリティ、パフォーマンス等の**本番グレード工程スキル** |
| 配布 | `npx skills add addyosmani/agent-skills` または Claude Plugin Marketplace |

### 10. cursor.directory — Cursor コミュニティ Plugin ディレクトリ

| 項目 | 内容 |
|------|------|
| 性質 | Cursor 向けコミュニティ Plugin/Skills ディレクトリ（83k+ 開発者） |
| 特徴 | Cursor 公式 Marketplace ではないが、実質的な発見ハブ |
| 備考 | Cursor 自体は `.cursor/skills/` ローカル発見 + GitHub インポートが基本 |

---

## ClawHub 互換・セルフホスト OSS

企業が ClawHub の publish/install ワークフローを維持しつつ private Registry を運用する需要に応じ、ClawHub API 互換を標榜する OSS が複数存在する。**スター数が極端に少ないものは実利用実績が乏しいため、ここでは iflytek/skillhub のみ詳述し、他は参考情報とする。**

| プロジェクト | Stars | 特徴 | 備考 |
|-------------|-------|------|------|
| **iflytek/skillhub** | ~4,800 | Java、RBAC、監査、Scanner、K8s | 最も成熟したセルフホスト候補 |
| **hermit-labs/hermit** | ~14 | Go、ClawHub API 完全互換、Upstream Proxy | ClawHub を lazy-cache ミラー可能 |
| **saker-ai/skillhub** | ~6 | Go 単一バイナリ、SQLite/PG | 軽量セルフホスト |
| **kms9/skills** | ~3 | ClawHub フォーク + 管理画面 + 飛書認証 | 中国語圏向けカスタム deploy |
| **erhwenkuo/wiclawhub** | ~3 | FastAPI、ClawHub OpenAPI v1 互換、セキュリティスキャン | 台湾発、エンタープライズ志向 |

**Hermit** の設計は特に興味深い。3種類の Repository タイプを持つ:

- **Hosted**: 自社 first-party スキルの publish 先
- **Proxy**: ClawHub 等 upstream の lazy-cache ミラー
- **Group**: Hosted + Proxy を統合した読み取りエンドポイント

これにより「社内スキル + 公開 ClawHub スキル」を単一エンドポイントで提供できる。

---

## エコシステムの整理：どれを選ぶか

### レイヤー別おすすめ

| 目的 | 推奨 |
|------|------|
| OpenClaw ユーザーが公開スキルを探す | **ClawHub**（clawhub.ai） |
| 複数エージェント（Cursor/Claude/Codex）で GitHub ベース配布 | **skills.sh** + `npx skills` |
| 200万スキルから探索・調査 | **SkillsMP**（必ずソース監査） |
| 規格準拠を確認 | **agentskills.io** + `skills-ref validate` |
| Claude Code プラグインとして配布 | **Claude Plugin Marketplace** 形式 |
| 社内 private Registry（ClawHub CLI 互換） | **iflytek/skillhub** |
| ClawHub + 社内スキルのハイブリッド | **Hermit**（Proxy 機能） |

### ClawHub vs skills.sh の本質的差異

| 観点 | ClawHub | skills.sh |
|------|---------|-----------|
| アーキテクチャ | 中央 Registry サーバー | GitHub がソース・Registry なし |
| バージョン管理 | semver + lock file | Git ref / repo 更新 |
| 検索 | embedding ベクトル検索 | skills.sh リーダーボード + `npx skills find` |
| 対象エージェント | OpenClaw 中心（CLI は `--dir` で汎用化可） | 70+ エージェントネイティブ |
| セキュリティ | モデレーション + VT スキャン（インシデント後強化） | 利用者監査 |
| メタデータ | `metadata.openclaw` 拡張 | Agent Skills 標準 frontmatter |

両者は競合というより**異なる配布哲学**。ClawHub は「App Store 型」、skills.sh は「npm/GitHub 型」。

---

## 詳細：Agent Skills 規格の技術的深掘り

### Progressive Disclosure の実装パターン

Microsoft Agent Framework のドキュメントも Agent Skills 規格を採用しており、4段階モデルが説明されている:

1. **Advertise**: 全スキルの name/description をコンテキストに載せる
2. **Load**: マッチ時に SKILL.md 全文ロード
3. **Expand**: references/ を必要時ロード
4. **Execute**: scripts/ を実行（出力のみコンテキストに入る）

SKILL.md 本文は500行以下を推奨。詳細は `references/` に分離する。

### allowed-tools（実験的）

```yaml
allowed-tools: Bash(git:*) Read
```

スキルが使用可能なツールを事前宣言するフィールド。Claude Code 等でサポート状況はクライアント依存。

### クライアント間の互換性

agentskills.io の Client Showcase（2026年6月時点）には40+製品が掲載。同一 SKILL.md を Claude Code → Cursor → Codex と移植可能なのが規格の最大の価値。

ただし **Marketplace/Plugin 統合はクライアントごとに異なる**。Claude Code ではカスタム marketplace の skills が Skill ツールに露出しないバグ（GitHub Issue #10568）が報告されており、エコシステムは「フォーマットは統一、配布は分散」の状態。

---

## 具体例・応用事例

### 事例1: Vercel Engineering の React Best Practices

`vercel-labs/agent-skills` の `react-best-practices` スキルは skills.sh リーダーボード上位（185K+ インストール）。React/Next.js パフォーマンス最適化ガイドラインをエージェントに注入する。

```bash
npx skills add vercel-labs/agent-skills --skill react-best-practices
```

### 事例2: Addy Osmani の SDLC スキルパック

24スキルで要件ヒアリング（interview-me）→ 仕様駆動開発 → TDD → コードレビュー → セキュリティ → デプロイまでをカバー。`/brainstorm` 等のスラッシュコマンドと連携。

### 事例3: OpenClaw + ClawHub の個人アシスタント

ユーザーは WhatsApp/Telegram 経由で OpenClaw に指示。ClawHub から `calendar-pro` や `todoist-cli` 等のスキルをインストールし、メッセージング UI からタスク管理・スマートホーム連携を実現。

### 事例4: 企業 SkillHub による社内標準化

iflytek/skillhub を K8s 上にデプロイ。チーム namespace（`my-team--code-review`）で RBAC 管理。ClawHub CLI 互換 API により、開発者は既存ワークフローを変えずに社内 Registry へ切り替え。

---

## 重要人物・文献

### 規格・公式

- **Anthropic**: Agent Skills 規格策定（agentskills.io, 2025年12月公開）
- **agentskills/agentskills**: 仕様リポジトリ
- **anthropics/skills**: リファレンス実装

### ClawHub / OpenClaw

- **Peter Steinberger**: OpenClaw 創始者（2026年 OpenAI 入社後、コミュニティ主導に移行）
- **openclaw/clawhub**: ClawHub プラットフォーム OSS
- **VoltAgent/awesome-openclaw-skills**: コミュニティキュレーション

### skills.sh エコシステム

- **Vercel Labs（Andrew Qu, Shu Ding）**: `npx skills` CLI、skills.sh 立ち上げ（2026年1月）
- **Addy Osmani**: agent-skills キュレーションコレクション

### セキュリティ研究

- **Koi Security（Oren Yomtov）**: ClawHavoc 初報（2026年2月1日）
- **Antiy Labs**: 1184件の悪意あるスキル分析
- **Snyk ToxicSkills レポート**: 3984スキル中13.4%が critical セキュリティ問題

---

## 最新動向・未解決問題

### セキュリティ：ClawHavoc の教訓

2026年2月の ClawHavoc は AI サプライチェーン攻撃の転換点となった。

**攻撃手法:**
- 人気ツール（Polymarket bot、Google Workspace、Solana wallet 等）を装ったスキル
- SKILL.md 内の「Prerequisites」セクションに隠されたシェルコマンド
- AMOS（macOS インフォスティーラー）配布
- 単一 C2 IP（91.92.242.30）への集中

**対策（ClawHub 側）:**
- VirusTotal マルウェアスキャン統合
- Verified Skill Screening
- LLM ベースのセキュリティ評価
- 3件以上の通報で自動非表示
- GitHub アカウント age gate（1週間以上）

**未解決:**
- オープン Registry とセキュリティのトレードオフは根本的に解決していない
- skills.sh / SkillsMP 等 GitHub ベースの配布も同様のリスクを持つ
- `allowed-tools` 等の権限モデルは実験段階
- エージェントの自律インストールを許す場合、サンドボックス・署名検証が必須

### 規格統一 vs 配布分散

Agent Skills フォーマットは統一されつつあるが、**配布メカニズムは ClawHub / skills.sh / Claude Marketplace / SkillsMP と分散**している。開発者は「1回書いてどこでも配布」にはまだ至っていない。

### エンタープライズ adoption

iflytek/skillhub の急成長（2026年3月作成、約4800スター）は、企業が「ClawHub の UX + 自社インフラ」を求めているシグナル。RBAC、監査ログ、Skill Scanner はエンタープライズ必須要件になりつつある。

### 有料 Skills マーケット

ClawHub は有料スキル非対応（MIT-0 強制）。Agensi 等の商用マーケットプレイス（8点セキュリティスキャン、クリエイター報酬80%）が別レイヤーとして存在するが、OSS Registry とは別系統。

---

## 関連トピック

### MCP（Model Context Protocol）との関係

| | MCP | Agent Skills |
|---|-----|--------------|
| 役割 | ツール・データソース接続 | 手順・ワークフロー・判断基準 |
| 単位 | Server + Tool 定義 | SKILL.md フォルダ |
| 例 | GitHub API、DB クエリ | 「PR レビューの手順」「デプロイチェックリスト」 |

Skills は MCP ツールを**どう使うか**を教える層。両者は補完関係。

### Cursor Rules から Skills への移行

Cursor 2.4+ では `.cursor/rules/` や `.cursor/commands/` から `.cursor/skills/` への移行が進行。`/migrate-to-skills` 組み込みスキルで変換可能。Rules は常時コンテキスト、Skills は必要時ロードという設計差。

### Plugin vs Skill

Claude Code では Plugin が skills + commands + hooks + MCP を束ねた上位概念。1 Plugin に複数 SKILL.md を含められる。ClawHub も 2026年に Code Plugin / Bundle Plugin カタログを追加し、Skills 単体から拡張中。

---

## まとめ：ClawHub を中心としたエコシステム像

```
                    ┌─────────────────────────────────────┐
                    │     Agent Skills 規格 (agentskills.io)     │
                    │     SKILL.md + progressive disclosure      │
                    └─────────────────┬───────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
   ┌─────────────┐           ┌─────────────┐           ┌─────────────────┐
   │  ClawHub    │           │  skills.sh  │           │ Claude Plugin   │
   │  (Registry) │           │  (GitHub型) │           │  Marketplace    │
   │  ~9K stars  │           │  ~28K stars │           │ 2500+ catalogs  │
   └──────┬──────┘           └─────────────┘           └─────────────────┘
          │                           │
          ▼                           ▼
   ┌─────────────┐           ┌─────────────┐
   │  OpenClaw   │           │ Cursor/Codex│
   │  ~385K stars│           │ 70+ agents  │
   └─────────────┘           └─────────────┘

   セルフホスト層: iflytek/skillhub (~4.8K), Hermit (Proxy)
   発見層: SkillsMP (2M+), awesome-openclaw-skills (~52K)
   参照層: anthropics/skills (~166K), addyosmani/agent-skills (~81K)
```

**ClawHub とは**: OpenClaw 公式の公開 Skills Registry。`SKILL.md` ベースのスキルを semver 管理・ベクトル検索・CLI/API で publish/install できる「AI エージェント向け npm」。OSS 実装は `openclaw/clawhub`。

**ClawHub 互換**: ClawHub OpenAPI v1 / CLI プロトコルを実装したセルフホスト Registry（iflytek/skillhub、Hermit 等）。`CLAWHUB_REGISTRY` 環境変数で切り替え。

**実務的推奨**:
- OpenClaw ユーザー → ClawHub（インストール前に SKILL.md を必ず目視確認）
- マルチエージェント開発 → skills.sh + `npx skills`
- 社内標準化 → iflytek/skillhub 等のセルフホスト
- 探索・調査 → SkillsMP（ソース監査必須）
- 品質重視 → anthropics/skills、addyosmani/agent-skills 等のキュレーション

---

## 参考リンク

### 規格
- https://agentskills.io
- https://agentskills.io/specification
- https://github.com/agentskills/agentskills

### ClawHub / OpenClaw
- https://clawhub.ai
- https://github.com/openclaw/clawhub
- https://docs.openclaw.ai/clawhub
- https://docs.openclaw.ai/clawhub/skill-format
- https://github.com/openclaw/openclaw

### skills.sh エコシステム
- https://skills.sh
- https://github.com/vercel-labs/skills
- https://vercel.com/changelog/introducing-skills-the-open-agent-skills-ecosystem

### Aggregator / Curated
- https://skillsmp.com
- https://github.com/VoltAgent/awesome-openclaw-skills
- https://github.com/anthropics/skills
- https://github.com/addyosmani/agent-skills

### セルフホスト Registry
- https://github.com/iflytek/skillhub
- https://iflytek.github.io/skillhub/
- https://github.com/hermit-labs/hermit

### Claude Code Marketplace
- https://code.claude.com/docs/en/plugin-marketplaces
- https://github.com/anthropics/claude-plugins-official

### セキュリティ
- Koi Security ClawHavoc 報告（2026年2月）
- https://www.antiy.net/p/clawhavoc-analysis-of-large-scale-poisoning-campaign-targeting-the-openclaw-skill-market-for-ai-agents/
- https://www.prplbx.com/blog/agent-skills-supply-chain

### エコシステム分析
- https://agentman.ai/blog/agent-skills-ecosystem-report-2026
- https://www.agensi.io/learn/best-ai-agent-skills-marketplaces-2026
