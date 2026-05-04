# AIエージェントを賢く使う「スキル」と「サブエージェント」——配布エコシステムと実用コレクションの全貌

## 概要

2025年後半から2026年にかけて、AIエージェントの世界に劇的な変化が起きている。Claude Code、OpenAI Codex、Gemini CLIといったコーディングエージェントが急速に普及する中で、それらのエージェントを「自分好みに強化する」ための共通言語として「**Agent Skills（エージェントスキル）**」という概念が誕生し、オープンスタンダードとして急速に普及した。

スキルとは何か。一言でいえば、AIエージェントに特定のタスクの実行方法を教えるためのMarkdownファイルのパッケージだ。料理に例えるなら「レシピカード」に相当する。エージェントはそのレシピを読み込むことで、「PRのコードレビューをするときはこの手順で」「セキュリティ脆弱性をチェックするときはこのフレームワークで」といった繰り返し作業を一貫して高品質にこなせるようになる。

さらに「**サブエージェント（sub-agent）**」という概念も重要だ。メインのAIエージェントが特定のタスクを専門エージェントに委譲することで、コンテキストの汚染を防ぎながら複雑なワークフローを実現できる。「コードレビュー係」「リサーチ係」「デプロイ係」のように、それぞれの専門エージェントが分業する形だ。

本稿では、（1）スキルとサブエージェントの技術的な仕組み、（2）実際に公開・配布されている人気スキル・サブエージェントの具体例、（3）自分で作ったスキルをチームや世界に広める配布方法、の三つを柱に深掘りする。

---

## 背景・歴史——「コンテキストに詰め込む」時代の終わり

AIエージェントの初期（2022〜2024年頃）、プロジェクト固有の知識やルールをエージェントに覚えさせる方法は主に二つだった。

1. **システムプロンプトに直書き**：「このプロジェクトではPEP 8に従え」「GitHubのコメントはこのフォーマットで」といった指示をプロンプトの冒頭に山ほど詰め込む
2. **CLAUDE.md / AGENTS.md などのコンテキストファイル**：プロジェクトルートに置いたMarkdownをエージェントが起動時に読み込む

しかしこの方法には根本的な問題があった。すべての指示が常にコンテキストウィンドウを圧迫し、トークンコストが膨らみ、長い会話でモデルの注意が散漫になる。「ドキュメント化したけど結局AIが守ってくれない」という問題は世界中の開発者が経験した。

この問題に対するエレガントな解決策として、2025年10月にAnthropicが「**Agent Skills**」機能を発表した。そして2025年12月18日、Anthropicはこれを**オープンスタンダード**として公開し、他のAIツールへの採用を呼びかけた。

スキルの核心的なアイデアは**プログレッシブディスクロージャー（段階的開示）**だ。エージェントはスタートアップ時にスキルの「名前と説明文」（1スキルあたり30〜50トークン程度）だけをロードする。ユーザーがそのスキルを使う必要が生じたとき——あるいはエージェント自身が「このスキルが関係する」と判断したとき——はじめて全文をロードする。これにより大量のスキルを用意しても、使っていない間はコンテキストをほぼ消費しない。

---

## 核となる概念

### SKILL.md フォーマット——スキルの「レシピカード」

Agent Skillsオープンスタンダードの核心は `SKILL.md` というファイル形式だ。すべてのスキルは最低限このファイルを含むディレクトリとして定義される。

```
my-skill/
├── SKILL.md           # メイン指示書（必須）
├── template.md        # Claudeが埋めるテンプレート（任意）
├── examples/
│   └── sample.md      # 期待する出力例（任意）
└── scripts/
    └── validate.sh    # Claudeが実行できるスクリプト（任意）
```

`SKILL.md` はYAMLフロントマターとMarkdown本文の二部構成だ。

```yaml
---
name: pr-summary
description: Pull Requestの変更をサマリーし、リスクを特定する。
             差分確認・コミットメッセージ作成・レビュー依頼の際に使用。
disable-model-invocation: false
allowed-tools: Bash(gh *)
context: fork
agent: Explore
---

## PRの内容
- 差分: !`gh pr diff`
- コメント: !`gh pr view --comments`
- 変更ファイル: !`gh pr diff --name-only`

## 指示
上記の内容に基づきPRを3〜5点でサマリーし、
セキュリティリスク・テスト漏れ・破壊的変更がないか確認してください。
```

フロントマターの主なフィールドを整理する。

| フィールド | 説明 |
|---|---|
| `name` | スキル名（`/name` で呼び出せる） |
| `description` | エージェントがいつ使うかを判断するための説明文 |
| `disable-model-invocation` | `true` にするとユーザーの手動呼び出しのみ（デプロイ等の副作用あるスキルに） |
| `user-invocable` | `false` にするとメニューから非表示（エージェント専用の背景知識） |
| `allowed-tools` | このスキル実行中に許可するツール（都度承認なし） |
| `context` | `fork` に設定するとサブエージェントの独立コンテキストで実行 |
| `agent` | `context: fork` 時に使用するエージェントタイプ |
| `paths` | 特定のファイルパターンに一致するときだけ自動ロード |
| `model` | このスキル実行時に使用するモデル（コスト最適化に） |
| `effort` | 思考努力レベル（`low/medium/high/xhigh/max`） |

特筆すべきは `` !`コマンド` `` 構文による**動的コンテキスト注入**だ。スキルがロードされる直前にシェルコマンドが実行され、その出力がプロンプトに埋め込まれる。`!git diff HEAD` を書けば現在の差分が自動でプロンプトに入る。これはClaudeが実行するのではなく、スキルのプリプロセッシングとして行われる。

### スコープ——どこに置くかで誰が使えるか決まる

スキルの配置場所によって、誰が使えるかが決まる。

| スコープ | パス | 対象 |
|---|---|---|
| **エンタープライズ** | 管理者の Managed Settings | 組織内全ユーザー |
| **パーソナル** | `~/.claude/skills/<スキル名>/` | 自分の全プロジェクト |
| **プロジェクト** | `.claude/skills/<スキル名>/` | そのプロジェクトのみ |
| **プラグイン** | `<プラグイン>/skills/<スキル名>/` | プラグインが有効な場所 |

同じ名前のスキルが複数のスコープに存在する場合、エンタープライズ > パーソナル > プロジェクト の優先順位で上書きされる。プラグインスキルは `plugin-name:skill-name` 名前空間を持つため競合しない。

### サブエージェント——専門AIの分業体制

サブエージェントは、メインのエージェントから特定タスクを委譲される専門AIだ。最大の利点はコンテキストの独立性にある。ファイル探索で大量のログやファイル内容が溢れても、それがメインの会話を汚染しない。

Claude Code では `.claude/agents/<エージェント名>.md` ファイルとして定義する。

```yaml
---
description: セキュリティ脆弱性をチェックする専門エージェント。
             新しいコードが追加されたとき、または /security-audit と呼ばれたとき使用。
tools: Read, Grep, Bash
model: claude-haiku-4-5  # 高速・低コストモデルを指定可
allowed-tools: Read Grep Bash(grep *) Bash(semgrep *)
---

あなたはセキュリティ専門家です。
OWASP Top 10 を参照しながら、提示されたコードの脆弱性を分析してください。
SQL インジェクション、XSS、SSRF、認証の不備などに特に注意を払い、
発見した問題を重大度別に整理してレポートしてください。
```

組み込みのサブエージェントタイプとしては `Explore`（読み取り専用のリサーチ）、`Plan`（計画立案）、`general-purpose`（汎用）が用意されている。

---

## 詳細な仕組み・エコシステム

### オープンスタンダードとしての普及

Agent Skills の最大の特徴は、特定ベンダーに縛られない**クロスツール互換性**だ。2025年12月18日にAnthropicがオープンスタンダード（Apache 2.0 / CC-BY-4.0）として公開したのち、主要ツールが相次いで採用した。

2026年5月時点で対応ツールは26種以上に上る：

- **Claude Code**（Anthropic）— `.claude/skills/`
- **Codex CLI**（OpenAI）— `~/.agents/skills/` または `.agents/skills/`
- **Gemini CLI**（Google）— `~/.gemini/skills/` または `.agents/skills/`
- **GitHub Copilot**（Microsoft）— `.github/skills/` または `.claude/skills/`（後方互換）
- **Cursor** — `.cursor/skills/`（手動配置）
- **Windsurf** — `.windsurf/skills/`（2026年3月対応）
- **Cline、Roo Code、OpenCode、Amp、Goose** — 各自の実装

`.agents/skills/` ディレクトリは複数ツール間の**共通エイリアス**として機能し、一度スキルを置けば多くのツールで動作する設計になっている。

### ツールごとのスキル探索の仕組み

**OpenAI Codex** はスキルを「プログレッシブディスクロージャー」で管理する。起動時にはスキルの名前・説明・ファイルパスだけをロードし（スキル一覧がコンテキストに入る）、実際にそのスキルが必要と判断した時点で全文をロードする。個人スキルは `$HOME/.agents/skills/`、チーム共有スキルはリポジトリ内の `.agents/skills/` に置く。

**Gemini CLI** はスキルの探索を優先度順で行う：組み込みスキル → 拡張スキル → ユーザースキル（`~/.gemini/skills/`）→ ワークスペーススキル（`.gemini/skills/`）。`.agents/skills/` エイリアスも有効で、こちらの優先度が高い。ワークスペーススキルはトラストが必要だが、ユーザースキルはトラスト不要で安全に使える。

**GitHub Copilot（VS Code）** は `.github/skills/` を自動検出する。すでに Claude Code 向けに `.claude/skills/` を設定していれば後方互換でそのまま使える点が便利だ。2025年12月18日の対応発表以降、`github/awesome-copilot` リポジトリにコミュニティ製スキルが集積している。

### MCP（Model Context Protocol）との関係

Agent Skills と混同されがちなのが **MCP（Model Context Protocol）** だ。MCPはAnthropicが2024年後半に発表したプロトコルで、AIエージェントが外部ツール・データソース・APIと接続するための「USB-Cポート」に相当する。

- **MCPサーバー** → データベース操作、ファイル操作、外部API呼び出しなど、**ツールを提供する**
- **Agent Skills** → 手順・知識・ワークフローを記述したMarkdown、**方法を教える**

MCPは「何ができるか（ツール）」を拡張し、Skills は「どうやるか（手順）」を教える。実用上は両方を組み合わせて使う。例えば「Jiraタスクを作成するスキル」を書き、そのスキルが使うMCPサーバー（Atlassian MCP）を別途設定する、という形だ。

2026年4月時点でnpm上に「mcp」を含むパッケージは6,200以上、GitHubのmcp-serverタグ付きリポジトリは7,800以上に達し、MCP公式レジストリには9,400以上のサーバーが登録されている。

---

## 配布方法——スキルを世界に届ける手段

### 方法1：GitHubリポジトリで公開（最も一般的）

最もシンプルな配布方法は、スキルを含むGitHubリポジトリを公開することだ。利用者はリポジトリをクローンするか、必要なスキルディレクトリだけをコピーして使う。

チームで使うスキルはプロジェクトの `.claude/skills/` ディレクトリに含めてバージョン管理するだけでよい。`git pull` すればチーム全員が最新のスキルを受け取れる。

### 方法2：npx skills CLI（Vercel製）

Vercelが開発した `npx skills` コマンドは、エージェントスキルの「npm」とも呼べるパッケージマネージャーだ。グローバルインストール不要で常に最新版を使える。

```bash
# スキルを検索
npx skills find typescript

# GitHubリポジトリからスキルをインストール
npx skills add owner/repo

# インストール済みスキル一覧
npx skills list

# スキルを更新
npx skills update -g

# 新しいスキルを作成
npx skills init
```

`skills.sh`（skills.sh）はこのエコシステムの**公式ディレクトリ兼リーダーボード**だ。2026年1月にVercelが立ち上げ、インストール数ベースのリアルタイムランキングを提供している。2026年3月時点での最人気スキルは Vercel Labs の `find-skills`（57万9千インストール以上）だった。対応エージェントは19種類以上。

### 方法3：ccpi CLI（tonsofskills.com）

`ccpi`（Claude Code Package Installer）は、コミュニティが構築した独立のパッケージマネージャーだ。

```bash
# グローバルインストール
pnpm add -g @intentsolutionsio/ccpi

# スキルを検索
ccpi search "security"

# インストール
ccpi install my-plugin

# インストール済み一覧
ccpi list --installed
```

tonsofskills.com に425以上のプラグイン、2,810以上のスキル、200以上のエージェントがカタログ化されており、毎日GitHub Actionsで自動更新される。

### 方法4：プラグイン（Claude Code 特有）

Claudeのプラグインシステムは、スキル・MCPサーバー・サブエージェント・カスタムコマンドを**一つのパッケージ**にまとめて配布できる仕組みだ。

```
my-plugin/
├── plugin.json       # プラグインメタデータ
├── skills/
│   ├── code-review/SKILL.md
│   └── deploy/SKILL.md
├── agents/
│   └── security-auditor.md
└── mcp/
    └── config.json
```

Claude の `/plugin` コマンドから「Discover」タブを開くか、`claude.com/plugins` を訪問するとプラグインマーケットプレイスにアクセスできる。公式の `anthropics/claude-plugins-official` リポジトリが Anthropic 管理の高品質プラグインを集約している。2026年5月時点で4,200以上のスキル、770以上のMCPサーバー、2,500以上のマーケットプレイスが存在する。

### 方法5：エンタープライズ・マネージドデプロイ

Claude Team / Enterprise プランでは、管理者が **Managed Settings**（管理設定）を通じて組織全体にスキルを強制配布できる。

- 管理者が一元管理するスキルはデフォルトで全ユーザーに有効になる
- 個々のユーザーは管理者が許可した範囲で特定スキルをオフにできる
- エンタープライズ設定がパーソナル設定より優先される

2025年12月18日のアップデートで追加されたこの機能は、全社共通の業務ルール（「社内システムへのAPIコールはこの手順で」「ドキュメントはこのテンプレートで」）を自動で全エージェントに適用できる画期的な仕組みだ。

---

## 実際に配布されている人気スキル・サブエージェント集

### 公式・Anthropic提供スキル

**anthropics/skills**（公式リポジトリ）には以下のスキルが含まれている：

| スキル名 | 機能 |
|---|---|
| `simplify` | 変更したコードを品質・効率の観点でレビューし修正する |
| `debug` | 系統的なデバッグ手法を強制し科学的に問題を特定する |
| `batch` | 大量ファイルを並列処理する |
| `loop` | 定期的にコマンドやスキルを繰り返す |
| `security-review` | ブランチの変更をセキュリティ観点でレビューする |
| `review` | PRをレビューする |
| `claude-api` | Anthropic SDK / Claude API を活用したアプリを構築・最適化する |
| `init` | CLAUDE.md の初期化 |
| `session-start-hook` | Claude Code Web向けのStartupフック設定 |
| `podcast-research` | トピックを深くリサーチしポッドキャスト台本用レポートを作成する |
| `update-config` | settings.json の設定を変更する |
| `supabase` | Supabase 関連のあらゆるタスクに対応する |

また、ドキュメント操作スキルとして `create-word-document`、`create-powerpoint`、`create-excel`、`process-pdf` なども公開されている。

### addyosmani/agent-skills——プロダクション品質の20スキル

Googleのエンジニアリング文化（『Software Engineering at Google』に基づく）を体系化した、開発フェーズ別の20スキルセット。Claude Code、Cursor、Gemini CLI、Windsurf に対応。

| カテゴリ | スキル |
|---|---|
| **企画・設計** | `idea-refine`、`spec-driven-development`、`planning-and-task-breakdown` |
| **実装** | `incremental-implementation`、`context-engineering`、`frontend-ui-engineering` |
| **テスト・品質** | `test-driven-development`、`browser-testing-with-devtools`、`code-review-and-quality` |
| **セキュリティ・性能** | `security-and-hardening`、`performance-optimization` |
| **DevOps** | `git-workflow-and-versioning`、`ci-cd-and-automation`、`shipping-and-launch` |
| **保守** | `deprecation-and-migration`、`documentation-and-adrs` |
| **デバッグ** | `debugging-and-error-recovery` |

タスクの内容に応じてスキルが自動起動する設計で、「APIを設計する」と言えば `api-and-interface-design` が、「UIを作る」と言えば `frontend-ui-engineering` が自動でロードされる。

### VoltAgent/awesome-agent-skills——1,000件超のコミュニティコレクション

最大規模のエージェントスキルコレクション。Claude Code、Codex、Gemini CLI、Cursor、GitHub Copilot、Windsurf など全主要ツールに対応。AI生成の低品質スキルを除外し、実際のエンジニアリングチームが使用する「本物のスキル」のみを厳選している。

主な提供元とスキル例：

- **Anthropic** — ドキュメント操作（Word/PowerPoint/Excel/PDF）
- **Google** — API開発、クラウドワークフロー、Workspace CLI
- **Microsoft** — Azure SDK、AI Foundry、133種類以上の.NET/Java/Python/TypeScript向けスキル
- **Vercel、Cloudflare、Netlify** — Webデプロイメント
- **Hugging Face** — ML モデル操作
- **Figma** — UI/UXデザイン
- **コミュニティ** — Solanaアプリ開発、KiCad電子設計、色科学、TDD、システマティックデバッグ

### Orchestra-Research/AI-Research-SKILLs——研究自動化

AIリサーチの全ライフサイクル（文献調査 → アイデア生成 → 実験 → 論文執筆）を自動化する98スキル・23カテゴリのライブラリ。

2026年3月リリースの目玉は **Autoresearch**：
- 内側ループ（最適化）と外側ループ（統合）のツーループアーキテクチャ
- 文献調査 → アイデア創出 → 実験 → 統合 → 論文執筆を自律実行
- Prompt Guard（Meta製、86Mパラメータのプロンプトインジェクション検出）内蔵

コアスキルカテゴリ：モデルアーキテクチャ、ファインチューニング、分散トレーニング、推論最適化、評価、デプロイメントなど。

### letta-ai/skills——記憶付きエージェント向け

Letta（元MemGPT）の公式スキルリポジトリ。Letta Code と Claude Code の両方でそのまま動作する。注目スキル：

- `letta-api` — Letta API を使って状態付きAIエージェントアプリを構築する方法を教える
- `frontend-design` — AIが生成したように見えない、美しいWebUIを作成する
- `slack-gif-creator` — Slack用アニメーションGIFを作成する

### jeremylongshore/claude-code-plugins-plus-skills

ccpi パッケージマネージャーと連携した非公式マーケットプレイス。SaaS サービス向けパックが充実しており、ClickUp、Fly.io、Algolia、Fathom、Intercom などの専用スキルが揃っている。

### パートナー公式スキル（Anthropic認定）

Anthropicの公式パートナーが提供するスキル（`claude.com/connectors` のディレクトリから入手可能）：

| パートナー | スキルで実現できること |
|---|---|
| **Atlassian** | 仕様からバックログ生成、ステータスレポート作成、Jira/Trelloでのタスク管理 |
| **Figma** | デザインの意図をコードに変換、デザインコンテキストの自動把握 |
| **Canva** | ブランドガイドに沿ったマルチプラットフォームキャンペーン作成 |
| **Notion** | 社内知識の検索・参照、ドキュメント生成 |
| **Stripe** | 支払いフロー設計・実装支援 |
| **Zapier** | 他サービスへの自動化フロー構築 |
| **Sentry** | エラートリアージと修正 |
| **Ramp** | 経費管理・財務レポート |
| **Cloudflare** | エッジ関数・Workers の開発 |

---

## サブエージェントのコレクション

### VoltAgent/awesome-claude-code-subagents——100種類以上の専門サブエージェント

Claude Code 向けのサブエージェントを100種類以上収録したコレクション。カテゴリ別の内訳：

**コア開発系**
- `backend-engineer`：API設計・データベース設計・マイクロサービス
- `frontend-engineer`：React/Vue/Svelte、レスポンシブデザイン
- `mobile-engineer`：iOS/Android、React Native、Flutter
- `fullstack-architect`：E2Eシステム設計

**言語スペシャリスト**
- `python-pro`：Python、FastAPI、データサイエンス
- `typescript-expert`：TypeScriptの型システム、高度な型定義
- `rust-systems`：メモリ安全なシステムプログラミング
- `go-engineer`：並行処理、CloudNativeアプリ

**インフラ・DevOps**
- `kubernetes-operator`：K8sクラスタ管理、Helm、サービスメッシュ
- `aws-architect`：AWS Well-Architected Frameworkに基づく設計
- `terraform-iac`：IaCのベストプラクティス

**品質・セキュリティ**
- `code-reviewer`：PRレビュー、パターン検出、改善提案
- `security-auditor`：脆弱性スキャン、OWASP準拠チェック
- `test-automation-engineer`：TDD、E2Eテスト、テスト戦略

**データ・AI**
- `ml-engineer`：モデルトレーニング、MLOps、特徴量エンジニアリング
- `data-engineer`：ETLパイプライン、データウェアハウス
- `llm-specialist`：プロンプトエンジニアリング、RAG構築

**専門ドメイン**
- `game-developer`：ゲームエンジン（Unity/Unreal）、ゲームデザインパターン
- `blockchain-developer`：スマートコントラクト、DeFiプロトコル
- `fintech-engineer`：決済システム、規制対応（PCI DSS等）

**インストール方法**は `install-agents.sh` スクリプトでワンコマンド：

```bash
curl -sSL https://raw.githubusercontent.com/VoltAgent/awesome-claude-code-subagents/main/install-agents.sh | bash
```

インタラクティブモードで使いたいサブエージェントだけ選択してインストールできる。

### OpenAI Agents SDK のサブエージェント（Handoff）

Claude Code に限らず、Python で本格的なマルチエージェントシステムを構築する場合は OpenAI Agents SDK が有力な選択肢だ。

二つの協調パターンがある：

**パターン1：ハンドオフ（Handoffs）**
トリアージエージェントが会話の流れを見て、専門エージェントに完全に制御を渡す。

```python
from openai.agents import Agent, handoff

triage_agent = Agent(
    name="Triage",
    instructions="適切な専門エージェントに振り分ける",
    handoffs=[handoff(billing_agent), handoff(tech_support_agent)]
)
```

**パターン2：マネージャー（Agents as Tools）**
マネージャーエージェントが専門エージェントをツールとして呼び出し、自分がオーケストレーションを維持する。

```python
manager = Agent(
    name="Manager",
    tools=[research_agent.as_tool(), writer_agent.as_tool()]
)
```

注意点として、OpenAI Agents SDK は OpenAI モデルにのみ対応している（他プロバイダー非対応）。

### マルチエージェントフレームワークのサブエージェント

**CrewAI**（2026年時点で最速成長のフレームワーク）は「クルー（乗組員）」という比喩でマルチエージェントを表現する。各エージェントは `role`（役割）・`goal`（目標）・`backstory`（背景ストーリー）で定義され、タスクを担当し合う。2026年初頭には A2A（Agent-to-Agent）プロトコル互換性と MCP サポートも追加された。

**LangGraph** は状態グラフとしてエージェントを表現し、より細粒度のフロー制御が得意だ。月間検索数27,100（CrewAIの14,800を超えてトップ）と、プロダクション採用で最も信頼されている。

2026年のプロダクション環境では、LangGraph（グラフベース・耐久性重視）、CrewAI（ロールベース・立ち上がり速度重視）、Mastra（TypeScript優先・Vercelネイティブ）の三強が主要選択肢となっている。

---

## 配布とディスカバリーのエコシステム

### skills.sh——公式オープンディレクトリ

Vercelが2026年1月に立ち上げた `skills.sh` は、エージェントスキルのための中央ハブだ。19種類以上のAIエージェントに対応し、インストール統計がリアルタイムで公開されている。

「今週のトップスキル」セクションには毎週異なるスキルが登場し、コミュニティの注目を集める仕組みになっている。

### SkillsMP——GitHubを横断したスキルインデックス

SkillsMP Marketplace はGitHub上のすべてのスキルプロジェクトを自動インデックスし、カテゴリ・更新日時・スター数・タグで整理する。エコシステム全体の見通しが良くなる「スキルのGoogle Scholar」的なサービスだ。

### skillport——ユニバーサルスキルローダー

`gotalab/skillport` は CLI または MCP 経由で任意のAIエージェントにスキルを提供するブリッジツールだ。Cursor、Copilot、Windsurf、Cline、Codex、任意のMCP対応クライアントで動作する。スキルを一度管理すればどこでも配布できる「一元管理・多方展開」の思想を体現している。

### agent-skills-cli——40,000件超のスキルカタログ

`Karanjot786/agent-skills-cli` は SkillsMP から40,000以上のスキルにアクセスし、Cursor・Claude Code・GitHub Copilot・Codex・Windsurf などに一発同期できるユニバーサルCLIだ。

```bash
# キーワードでスキルを検索
agent-skills search typescript

# インストール（ツールを指定）
agent-skills install typescript-expert --tool claude-code

# 全ツールに同期
agent-skills sync --all-tools
```

---

## 重要人物・コミュニティ

- **Anthropic Skills チーム**：オープンスタンダードの設計と推進
- **Addy Osmani（Google）**：`addyosmani/agent-skills`でGoogleのエンジニアリング哲学をスキル化
- **Jeremy Longshore**：`jeremylongshore/claude-code-plugins-plus-skills` と ccpi エコシステムの構築
- **VoltAgent チーム**：`awesome-agent-skills`（スキル）と `awesome-claude-code-subagents`（サブエージェント）の二大コレクション運営
- **Orchestra Research**：AIリサーチ自動化スキルライブラリの開発
- **Letta（Adam Jermyn et al.）**：記憶付きエージェントとスキルシステムの先駆的開発

---

## 最新動向・未解決問題

### セキュリティ懸念——スキルの信頼性問題

プロジェクト `.claude/skills/` にチェックインされたスキルは `allowed-tools` フィールドで任意のツール権限を要求できる。悪意あるリポジトリをクローンしてワークスペース信頼を許可すると、スキルが広範なツールアクセスを得る可能性がある。論文「SkillProbe: Security Auditing for Emerging Agent Skill Marketplaces」（2026年3月）では、スキルマーケットプレイスに対するセキュリティ監査手法が提案されている。

Claude Code はワークスペース信頼ダイアログで一応の防御をしているが、エンタープライズ環境でのスキル管理ポリシーの整備が急務だ。

### コンテキスト管理の限界

多数のスキルを使うセッションでは、コンパクション（自動圧縮）後に古いスキルが文脈から失われることがある。Claude Code は各スキルの最初の5,000トークンを保持し、最大25,000トークンの予算内でスキルを再アタッチするが、長大なセッションでは限界がある。

### AIによるスキル自動生成

`FrancyJGLisboa/agent-skill-creator` などのツールは、ワークフローを説明するだけでSKILL.mdを自動生成する。品質のばらつきが課題だが、個人ユーザーが自分だけのスキルを素早く作れる敷居が劇的に下がった。

### エージェントチーム vs サブエージェント

Claude Code では「サブエージェント」（単一セッション内での委譲）と「エージェントチーム」（複数セッション間での協調）が区別されるようになってきた。エージェントチームは並列実行や長時間タスクに向き、今後の拡張が期待される。

### 日本語コミュニティの状況

日本語圏では Classmethod の DevelopersIO（2026年初頭に Anthropic 公式サンプル全16種レビュー記事）、窓の杜の連載「柳谷智宣のAIウォッチ！」、日本経済新聞の Agent Skills 特集（2026年1月25日付）などを通じて情報が普及してきた。ただし独自の日本語スキルライブラリの開発はまだ欧米に比べて遅れており、コミュニティ形成が課題となっている。

---

## 自分でスキルを作るためのベストプラクティス

### スキル設計のコツ

**1. 説明文（description）が命**
エージェントがスキルを自動起動するかどうかは、`description` の品質にかかっている。「いつ使うか」が明確に書かれていないスキルは決して起動されない。ユーザーが自然に発するフレーズを想像し、それにマッチするキーワードを含める。

```yaml
description: PRの変更をサマリーしてリスクを特定する。
             「何が変わった？」「コミットメッセージを書いて」「レビューして」などの質問で使用。
```

**2. 500行以内に抑える**
`SKILL.md` は500行以内が推奨。詳細なリファレンスは `reference.md` などに分割し、`SKILL.md` から参照するだけにする。

**3. 副作用があるスキルは手動起動のみに**
デプロイ、メール送信、本番DBへの書き込みなど、取り消せない操作は必ず `disable-model-invocation: true` を設定する。

**4. 動的コンテキスト注入を活用する**
`` !`git diff HEAD` `` のような動的注入を使うと、スキルが実際のデータに基づいて動作できる。Claudeに「差分を読んで」とお願いするより確実に差分が入る。

**5. context: fork で独立実行**
長時間の探索・分析タスクは `context: fork` でサブエージェントに委託し、メインコンテキストを守る。

### スキルのテスト方法

```bash
# スキル一覧の確認
/? # または "What skills are available?"

# 直接呼び出し
/my-skill

# 自動起動テスト：説明文にマッチする質問をする
"コードの変更点を確認してほしい"
```

### チームへの展開フロー

```
個人スキル開発 → プロジェクト .claude/skills/ に追加 → 
チームレビュー → バージョン管理（git） → 
将来的にプラグイン化 → マーケットプレイスへ公開
```

---

## 関連トピック

### コンテキストエンジニアリング

スキルは「コンテキストエンジニアリング」という新しい概念の実装例だ。AIに何をどのタイミングでどの量だけ伝えるかを設計する技術で、プロンプトエンジニアリングよりも一段抽象度が高い。`addyosmani/agent-skills` の `context-engineering` スキルはこの概念を明示的に扱っている。

### AGENTS.md / CLAUDE.md との使い分け

- **CLAUDE.md / AGENTS.md**：常にコンテキストに入る「プロジェクトの事実」。言語スタイル、コミット規約、ディレクトリ構造など。
- **SKILL.md**：必要なときだけロードされる「手順」。デプロイ手順、コードレビューフロー、ドキュメント生成など。

ルールは「短い事実はCLAUDE.md、長い手順はSKILL.md」だ。

### A2A（Agent-to-Agent）プロトコル

Google が提案した A2A プロトコルは、異なるフレームワーク間のエージェントが互いにやり取りするための標準化プロトコルだ。CrewAI v1.10.1 で対応が追加された。長期的にはスキルの「インポート・エクスポート」を超えた、エージェント間のリアルタイム協調が標準化されていく可能性がある。

### ローカルLLMとスキル

Ollama や LM Studio で動くローカルLLMでも SKILL.md フォーマットは利用可能だ。`Cline` や `Continue` などのIDEプラグインがローカルLLMをバックエンドとして SKILL.md を解釈できる。クラウドAPIを使わないプライバシー重視の環境でも、スキルエコシステムの恩恵を受けられる。

---

## まとめ——「スキルを共有する文化」の夜明け

Agent Skills オープンスタンダードの最大の意義は、AIエージェントへの知識伝達を「個人のプロンプト職人芸」から「共有・再利用できるパッケージ」へと昇華させたことだ。

OSSのライブラリと同じように、優れたスキルは公開され、改善され、フォークされ、コミュニティで磨かれていく。npm が JavaScript エコシステムを豊かにしたように、skills.sh や SkillsMP が AIエージェントのエコシステムを豊かにしていく——そのサイクルが今まさに始まっている。

2026年初頭の時点で1,000件超のコミュニティスキル、9,400以上のMCPサーバーが存在し、26種類以上のAIツールがオープンスタンダードを採用した。エンタープライズでは組織全体への一括デプロイが可能になり、パートナー企業がSaaS連携スキルを公式提供し始めた。

次の課題は**品質保証**と**セキュリティ**だ。誰でも書けるが故に玉石混交になるスキルの世界で、どうやって信頼できるスキルを選ぶか。セキュリティ研究者はすでにスキルマーケットプレイスへの攻撃ベクターを研究し始めている。

それでも全体的な流れは明確だ。AIエージェントの時代において、「どのモデルを使うか」と同じくらい「どんなスキルを持たせるか」が重要になってきた。スキルは、AIエージェントの「ソフトウェアライブラリ」なのだ。

---

## 参考リンク

### オープンスタンダード・公式ドキュメント
- [Agent Skills Open Standard（agentskills.io）](https://agentskills.io)
- [Claude Code - スキルドキュメント](https://code.claude.com/docs/en/skills)
- [Claude Code - サブエージェントドキュメント](https://code.claude.com/docs/en/sub-agents)
- [OpenAI Codex Agent Skills](https://developers.openai.com/codex/skills)
- [Gemini CLI Agent Skills](https://geminicli.com/docs/cli/skills/)
- [GitHub Copilot Agent Skills（VS Code）](https://code.visualstudio.com/docs/copilot/customization/agent-skills)
- [Agent Skills GitHub仕様リポジトリ](https://github.com/agentskills/agentskills)

### 主要スキルリポジトリ
- [anthropics/skills（公式）](https://github.com/anthropics/skills)
- [VoltAgent/awesome-agent-skills（1000件超）](https://github.com/VoltAgent/awesome-agent-skills)
- [addyosmani/agent-skills（プロダクション品質20スキル）](https://github.com/addyosmani/agent-skills)
- [letta-ai/skills](https://github.com/letta-ai/skills)
- [openai/skills（Codex公式）](https://github.com/openai/skills)
- [Orchestra-Research/AI-Research-SKILLs](https://github.com/Orchestra-Research/AI-research-SKILLs)
- [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills)
- [jeremylongshore/claude-code-plugins-plus-skills](https://github.com/jeremylongshore/claude-code-plugins-plus-skills)
- [google-gemini/gemini-skills](https://github.com/google-gemini/gemini-skills)
- [github/awesome-copilot](https://awesome-copilot.github.com/skills/)

### サブエージェントコレクション
- [VoltAgent/awesome-claude-code-subagents（100件超）](https://github.com/VoltAgent/awesome-claude-code-subagents)
- [OpenAI Agents SDK（ハンドオフ）](https://openai.github.io/openai-agents-python/multi_agent/)

### 配布・ディスカバリーツール
- [vercel-labs/skills（npx skills）](https://github.com/vercel-labs/skills)
- [skills.sh（公式ディレクトリ）](https://skills.sh)
- [skillmatic-ai/awesome-agent-skills](https://github.com/skillmatic-ai/awesome-agent-skills)
- [Vercel Agent Skills解説](https://vercel.com/kb/guide/agent-skills-creating-installing-and-sharing-reusable-agent-context)
- [Karanjot786/agent-skills-cli](https://github.com/Karanjot786/agent-skills-cli)
- [gotalab/skillport](https://github.com/gotalab/skillport)

### マーケットプレイス
- [claude.com/plugins（Claude公式）](https://claude.com/plugins)
- [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)
- [claudemarketplaces.com](https://claudemarketplaces.com/)
- [mcpmarket.com/tools/skills](https://mcpmarket.com/tools/skills)

### 解説記事（日本語）
- [Agent Skillsとは？業務知識をAIに共有する仕組みと導入手順（.Pro）](https://dotpro.net/lab/articles/ai-agent-skill/)
- [Agent Skills って何？Anthropicの公式サンプル16個をすべて試してみた（DevelopersIO）](https://dev.classmethod.jp/articles/try-agent-skills-anthropic-samples/)
- [AIを"即戦力の専門家"に変える「Agent Skills」（窓の杜）](https://forest.watch.impress.co.jp/docs/serial/yaaiwatch/2081968.html)
- [AIエージェント拡張仕様「Agent Skills」、短期間に標準へ（日本経済新聞）](https://www.nikkei.com/article/DGXZQOUC2513N0V20C26A1000000/)

### エンタープライズ導入
- [Introducing Agent Skills（Anthropic公式ブログ）](https://www.anthropic.com/news/skills)
- [Skills for organizations, partners, the ecosystem（Claude公式）](https://claude.com/blog/organization-skills-and-directory)
- [Claude Agent Skills for Enterprise（完全展開ガイド）](https://sidbharath.com/blog/claude-skills-for-teams-enterprise-deployment-guide/)

### マルチエージェントフレームワーク
- [CrewAI GitHub](https://github.com/crewaiinc/crewai)
- [OpenAI Agents SDK マルチエージェント](https://openai.github.io/openai-agents-python/multi_agent/)
- [Best Multi-Agent Frameworks in 2026](https://gurusup.com/blog/best-multi-agent-frameworks-2026)

### セキュリティ
- [SkillProbe: Security Auditing for Agent Skill Marketplaces（arXiv）](https://arxiv.org/html/2603.21019v1)
