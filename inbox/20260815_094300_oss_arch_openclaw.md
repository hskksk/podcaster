# OSSアーキテクチャ深掘りシリーズ: OpenClaw のアーキテクチャと設計思想

## 1. 概要とプロジェクトのビジョン

**OpenClaw**（[openclaw/openclaw](https://github.com/openclaw/openclaw)）は、ユーザー自身のデバイス上で動作する **ローカルファーストのパーソナル AI アシスタント** である。WhatsApp・Telegram・Slack・Discord・Signal・iMessage など 20 以上のメッセージングチャネルに接続し、LLM・ツール・スキル・メモリを 1 つの **Gateway（制御プレーン）** 配下に統合する。

調査時点（2026年8月）の規模感: GitHub スター 38 万超、主要言語 TypeScript、ライセンス MIT、OpenClaw Foundation による非営利運営。2025年1月にリポジトリ作成され、Warelay → Clawdbot → Moltbot → OpenClaw と名称を変えながら急成長した。

### 解決する課題

従来の ChatGPT / Claude 等のチャット UI とは異なり、OpenClaw は **「ユーザーが既に使っているチャネルで、実際に手を動かすアシスタント」** を目指す。

| 課題 | OpenClaw のアプローチ |
|------|----------------------|
| チャット UI に閉じた AI | メッセージングアプリ経由で 24/7 応答 |
| モデルベンダーロックイン | プロバイダ抽象化（Claude / GPT / Gemini / Ollama 等） |
| エージェント実行の安全性 | Gateway 認証、デバイスペアリング、exec approvals、サンドボックス |
| 拡張性 | Plugin SDK + Skills + MCP |
| 永続メモリ | Markdown ワークスペース + SQLite 状態管理 |

### ターゲットユーザー

- 自分の PC / VPS / Mac mini 上で **常時稼働する個人アシスタント** を持ちたいユーザー
- WhatsApp や Slack からファイル操作・シェル実行・ブラウザ操作を委譲したいパワーユーザー
- モデル・チャネル・ツールを **自分で選び、自分のルールで運用** したい開発者

### 設計上の核心思想（VISION.md より）

| 原則 | 内容 |
|------|------|
| **Local-first Gateway** | 単一の Gateway がセッション・チャネル・ツール・イベントの唯一の制御点 |
| **Lean Core, Rich Plugins** | コアは薄く保ち、オプション機能はプラグイン化 |
| **Per-call Tax Awareness** | コアに入るツール/プロンプト行は全リクエストに載るため、追加のハードルが高い |
| **Explicit Contracts** | `openclaw/plugin-sdk/*` 経由の明示的 API |
| **Security by Design** | 強力なデフォルト + オペレーターが明示的にリスクを引き受けるノブ |
| **SQLite-first State** | ランタイム状態は SQLite に集約（JSON/JSONL サイドカーはレガシー移行対象） |
| **Terminal-first Setup** | セキュリティ判断を隠さないオンボーディング |

---

## 2. システムアーキテクチャ

### 全体像：Gateway 中心の制御プレーン + 埋め込み Agent Runtime

OpenClaw の中核は **Gateway（デーモン）** と **Embedded Agent Runtime** の分離である。Gateway は「神経系」、Agent Runtime は「思考と実行」を担う。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Messaging Channels (20+)                              │
│  WhatsApp(Baileys) · Telegram(grammY) · Slack · Discord · Signal · ...  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ normalized message
┌───────────────────────────────▼─────────────────────────────────────────┐
│                         Gateway (daemon)                                 │
│  WS API (default ws://127.0.0.1:18789)                                   │
│  · channel connections · session routing · cron/webhooks                 │
│  · JSON Schema validated frames · idempotency · audit ledger             │
│  · Canvas host (/__openclaw__/canvas/, /__openclaw__/a2ui/)             │
└───────┬─────────────────┬──────────────────────┬────────────────────────┘
        │ WS (operator)   │ WS (role: node)      │ HTTP
        ▼                 ▼                      ▼
  CLI / Control UI    macOS/iOS/Android      WebChat / APIs
  / TUI / automations  Nodes (canvas, camera,
                       screen, location)
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   Embedded Agent Runtime (src/agents/)                   │
│  agent loop: intake → context → model → tools → stream → persist       │
│  · per-session lane queue · writer-claim fencing · compaction          │
│  · skills snapshot · bootstrap files · plugin hooks                      │
└───────┬─────────────────────────────────────────────────────────────────┘
        │
        ▼
  Model Providers (plugin) · Tools · Memory plugin · MCP · Skills
        │
        ▼
  ~/.openclaw/  (config, SQLite state, credentials, per-agent DB)
  workspace/    (AGENTS.md, SOUL.md, MEMORY.md, skills/)
```

### Gateway：WebSocket 制御プレーン

Gateway は **1 ホスト 1 インスタンス** が原則。WhatsApp（Baileys）セッションも Gateway だけが保持する。

**接続者の 3 分類:**

| ロール | 例 | 主な責務 |
|--------|-----|---------|
| Operator client | CLI, Control UI, TUI | `health`, `status`, `send`, `agent` 等 |
| Node | macOS/iOS/Android/headless | `canvas.*`, `camera.*`, `screen.record` 等 |
| WebChat | 静的 UI | 同一 WS API でチャット |

**ワイヤプロトコル（要点）:**

- 最初のフレームは必ず `connect`
- リクエスト: `{type:"req", id, method, params}` → レスポンス `{type:"res", ...}`
- イベント: `{type:"event", event, payload}`（`agent`, `chat`, `presence`, `health` 等）
- TypeBox スキーマ → JSON Schema → Swift モデル codegen
- 副作用メソッド（`send`, `agent`）は **idempotency key** 必須

**認証・信頼:**

- 全 WS クライアントは `connect` 時に **device identity** を提示
- 新デバイスはペアリング承認が必要（loopback は自動承認可）
- `connect.challenge` 署名（v3）で platform / deviceFamily をバインド
- Tailscale / SSH トンネル / TLS pinning でリモートアクセス

### Agent Loop：エージェント実行パイプライン

公式ドキュメントは agent loop を次のように定義する:

> intake → context assembly → model inference → tool execution → streaming → persistence

**エントリポイント:**

- Gateway RPC: `agent`, `agent.wait`
- CLI: `openclaw agent`

**実行シーケンス（簡略）:**

1. `agent` RPC がセッション解決し `{ runId, acceptedAt }` を即返却
2. `agentCommand` → `runEmbeddedAgent` がモデル解決・skills 読込・プロンプト組立
3. ランタイムイベントを `assistant` / `tool` / `lifecycle` ストリームに投影
4. `agent.wait` が lifecycle end/error を待機

**並行性制御（重要な設計判断）:**

- **セッションレーン** + **グローバルレーン** で直列化
- 同一セッションの並列実行を防ぎ、ツール競合と transcript 不整合を回避
- `activeWriterRunId` による **writer-claim fencing** で、上書きされた run が古い transcript を commit できないよう防御
- メッセージングチャネルは queue mode（`steer` / `followup` / `collect` / `interrupt`）を選択可能

### チャネルアーキテクチャ

チャネル実装は `src/channels/**` に配置。チャネルプラグインは **transport-only** で、ネイティブコールバックを OpenClaw の portable なメッセージ表現に正規化する。

**入力正規化フロー:**

1. 各プラットフォーム固有フォーマット（音声メモ、スレッド、メンション等）を受信
2. Channel Adapter が sender / body / attachments / metadata に正規化
3. ルーティングルールに基づき agent + session を決定
4. agent loop に投入

### マルチエージェントルーティング

1 Gateway 上で **複数の独立エージェント** を運用可能。各エージェントは:

- 専用 workspace（`agents.entries.*.workspace`）
- 専用 SQLite DB（`~/.openclaw/agents/<agentId>/agent/openclaw-agent.sqlite`）
- 独自の SOUL / AGENTS / MEMORY

チャネル・連絡先・グループ単位でルーティングを切り替え、例えば個人 DM 用とチームサポート用で別 persona・別ツールポリシーを持たせられる。

### プラグインシステム

OpenClaw の拡張は 4 層パイプライン:

```
Discovery → Selection → Load → Registry → (tools/channels/providers/hooks)
```

**2 つのプラグイン形態（VISION.md）:**

| 形態 | 用途 |
|------|------|
| Code plugin | runtime hooks, providers, channels, tools 等の in-process 拡張 |
| Bundle-style plugin | skills, MCP servers, 設定パッケージ（境界が小さい） |

**Capability モデル（代表例）:**

| Capability | 例 |
|------------|-----|
| Text inference | `anthropic`, `openai` |
| Channel / messaging | `matrix`, `msteams` |
| Web search / fetch | `brave`, `firecrawl` |
| Speech / TTS | `elevenlabs`, `microsoft` |
| Image / video generation | `fal`, `google` |

ネイティブプラグインは **Gateway と同一プロセス** で動作（サンドボックス外）。そのため install policy、provenance、ClawHub によるセキュリティレビューが重要。

**Memory は排他スロット:** 同時に 1 つの memory プラグインのみ active。

### Skills：オンデマンド指示ロード

Skills は `SKILL.md` を持つ instruction pack。読み込み優先度:

1. `<workspace>/skills`
2. `<project>/.agents/skills`
3. `~/.agents/skills`
4. `~/.openclaw/skills`
5. bundled / extraDirs

**重要な設計:** 全 skill 本文を system prompt に載せない。カタログ（name / description / path）だけ注入し、モデルが `read` で必要な `SKILL.md` をオンデマンド取得する。コンテキストウィンドウを節約する実践的パターン。

### メモリとワークスペース

各エージェントの workspace は **唯一の cwd**（ツール実行・コンテキストの基準ディレクトリ）。

**Bootstrap ファイル（Project Context として注入）:**

| ファイル | 役割 |
|----------|------|
| `AGENTS.md` | 運用指示 + メモリ方針 |
| `SOUL.md` | 人格・境界・トーン |
| `IDENTITY.md` | 名前・ vibe・ emoji |
| `USER.md` | ユーザープロフィール |
| `MEMORY.md` | 長期メモリ（存在時のみ注入） |
| `BOOTSTRAP.md` | 初回のみの儀式（完了後削除） |

日次ログ `memory/YYYY-MM-DD.md` や embedding 検索（sqlite-vec 等）は memory プラグイン経由。外部 DB に依存せず **Markdown + SQLite** で完結する思想。

### 状態ディレクトリ（~/.openclaw）

| パス | 内容 |
|------|------|
| `openclaw.json` | Gateway / agents / channels 設定 |
| `state/openclaw.sqlite` | 共有ランタイム状態 |
| `agents/<id>/agent/openclaw-agent.sqlite` | セッション行・エージェント状態 |
| credentials / pairing store | チャネル認証・デバイストークン |

---

## 3. 設計思想と開発の原則

### 3.1 Orchestration Layer の分離

OpenClaw が示す普遍的パターン: **生の LLM API をユーザー入力に直接晒さない**。Gateway がルーティング・キューイング・状態・認証を担い、Agent Runtime が推論とツール実行を担う。

### 3.2 ReAct Loop + Streaming

モデルは (1) テキスト返答 または (2) ツール呼び出し を選択。ツール結果は transcript に戻り、次の推論へ。OpenClaw はこの ReAct パターンを `runEmbeddedAgent` 内で実装し、`assistant` / `tool` イベントとしてクライアントへストリームする。

### 3.3 コンテキスト組立がプロダクト

system prompt は毎ターン `buildAgentSystemPrompt()` で再構築される（外部 harness のデフォルトプロンプトに依存しない）。構成要素:

1. OpenClaw base prompt
2. Skills カタログ
3. Bootstrap / Project Context
4. per-run overrides + plugin hooks (`before_prompt_build` 等)

`promptMode`: `full` / `minimal` / `none` でメイン・サブエージェント・cron を分離。KV cache 安定性のため、日時はタイムゾーンのみ注入し時刻文字列は避ける等の最適化も行う（別記事 `prompt_eng_openclaw` 参照）。

### 3.4 直列化を恐れない

エージェント共有状態では **セッション単位直列化** が意図的な設計。並列化より一貫性と安全性を優先。steering（実行中メッセージの割込み）は未開始ツールを skip する等、細かい境界制御がある。

### 3.5 設定互換性：Doctor による移行

ランタイムは **現行スキーマのみ** 読む。旧キーのサイレント互換はしない。`openclaw doctor --fix` が検出・バックアップ・書き換えを担当。プラグイン所有設定は各プラグインの doctor contract で修復。

### 3.6 2 層フック

| 種別 | 例 |
|------|-----|
| Internal Gateway hooks | `agent:bootstrap`, `/new`, `/reset` |
| Plugin hooks | `before_tool_call`, `before_prompt_build`, `message_sending`, `agent_end` 等 |

Outbound / tool guard では `{ block: true }` / `{ cancel: true }` が terminal で、低優先ハンドラは prior block を解除しない。

### 3.7 マージしないもの（ロードマップガードレール）

- ClawHub に載せられる新 core skills
- 既存 MCP/ACPX/プラグインパスと重複する MCP 作業
- manager-of-managers 型のエージェント階層をデフォルト化
- 既存チャネルの薄いラッパー

---

## 4. プロジェクト構造とコーディング規約

### 4.1 モノレポ構成（pnpm workspace）

| ディレクトリ | 役割 |
|-------------|------|
| `src/agents/` | 埋め込み agent runtime（loop, prompt, session） |
| `src/channels/` | チャネル実装・正規化 |
| `src/plugins/` | プラグイン読込・レジストリ |
| `src/gateway/` | WS サーバ・プロトコル・ルーティング |
| `src/plugin-sdk/` | 外部/ bundled プラグイン向け公開 API |
| `extensions/` | bundled プラグイン群 |
| `apps/macos`, `apps/ios`, `apps/android` | ネイティブ companion |
| `docs/` | Mintlify ベースの公式ドキュメント |
| `test/` | Vitest ベースの unit / contract / live tests |

エントリ CLI: `openclaw.mjs` → `openclaw` コマンド。Node **24.15+** 推奨（22.22.3+ もサポート）。

### 4.2 プロトコルと codegen

- **TypeBox** で WS プロトコル定義
- JSON Schema 生成 → フレーム検証
- Swift クライアントモデルも codegen

### 4.3 コーディング規約（CONTRIBUTING.md）

- **American English**（コード・コメント・docs・UI）
- Control UI は Lit **legacy decorators**（`@state()`, `@property()`）
- 1 PR = 1 issue/topic、著者あたり最大 20 open PR
- AI-assisted PR は明示（Evidence セクション必須）
- `CHANGELOG.md` は contributor PR では編集しない
- 拡張変更時は import boundary チェック必須

### 4.4 貢献フロー

- 小さな bug fix → 直接 PR 可
- 新機能 / アーキテクチャ → Issue または Discord で事前相談（多くは core ではなく plugin SDK 向け）
- リファクタのみ PR → 原則不可
- Skills 新規 → [ClawHub](https://clawhub.ai/) 優先

---

## 5. 品質保証と導入ツール

### 5.1 ローカル検証（PR 前）

```bash
pnpm build && pnpm check && pnpm test
```

拡張・プラグイン変更時:

```bash
pnpm test:extension <id>
pnpm test:contracts          # 全 plugin/channel 契約
pnpm test:contracts:channels
pnpm test:contracts:plugins
```

### 5.2 静的解析・構造チェック

| ツール | 目的 |
|--------|------|
| `pnpm check` | 総合チェック入口 |
| `pnpm check:architecture` | import cycle, deprecated API, DB-first legacy 等 |
| `pnpm check:import-cycles` / `check:madge-import-cycles` | 循環依存検出 |
| `pnpm check:protocol-coverage` | WS イベント網羅 |
| Knip | 未使用依存の削減（攻撃面最小化） |
| OpenGrep | PR 向け危険パターン rulepack |
| CodeQL | Node / macOS / Android CI ゲート |

### 5.3 テスト戦略

- **Vitest** ベースの unit / integration
- **Contract tests**: 登録済み plugin・channel が interface 契約を満たすか
- **Agent reliability evals**: Gateway 経由の tool-calling、wizard E2E
- **Prompt snapshots**: Codex runtime happy path の drift 検出
- **Live tests**: `OPENCLAW_LIVE_TEST=1` 等で実環境（Android node 等）

### 5.4 セキュリティパイプライン

- `security.installPolicy`: ディレクトリソースブロック、build 時 exec 承認
- NPM spec integrity（shasum / integrity hash）
- `openclaw doctor` / `openclaw plugins doctor` で compatibility signal
- SecretRef + fail-closed sentinel 解決

### 5.5 CI/CD

- GitHub Actions（`main` branch CI）
- マルチプラットフォーム build（CLI, Docker, macOS app, Android, iOS）
- `pnpm changed:lanes` による変更ベースの lane 実行
- release 検証: `ci:full-release`

---

## 6. まとめと学び

OpenClaw は「個人アシスタント」を **Gateway 制御プレーン + 埋め込み Agent Runtime + プラグインエコシステム** として実装した、2026年時点で最も参照価値の高い OSS の 1 つである。

### この OSS から学べるベストプラクティス

1. **制御プレーンと推論の分離** — メッセージング・認証・セッションは Gateway、思考は Agent Runtime
2. **セッション直列化 + writer fencing** — 共有状態エージェントでは並列より一貫性
3. **Skills のカタログ + オンデマンド read** — コンテキスト効率と拡張性の両立
4. **Lean core, plugin tax awareness** — 全リクエストに載るコアと、オプトインのプラグインを明確に分ける
5. **Markdown + SQLite** — 個人エージェント規模では過剰なインフラより単純な永続化
6. **TypeBox プロトコル + codegen** — CLI / Web / Swift が同一契約を共有
7. **Doctor による設定移行** — スキーマ破壊的変更を runtime 互換レイヤーで抱えない
8. **Contract tests for plugins** — in-process 拡張の安全性を CI で担保

### 関連する既存調査

本リポジトリには OpenClaw の **プロンプト設計** を扱った記事（`articles/20260521_170953_prompt_eng_openclaw.md`）が既にある。本稿はアーキテクチャ・モジュール構成・運用モデルに焦点を当て、プロンプト詳細は同記事を参照すると理解が深まる。

### 注意点

- ネイティブプラグインは in-process のため、**ClawHub 等のサプライチェーンリスク** が実在する（コミュニティ skill / plugin の監査が前提）
- 強力なツール（exec, browser, messaging）を持つ以上、**Gateway 認証・ペアリング・allowlist** は設定の中核

---

## 参考リンク

- リポジトリ: https://github.com/openclaw/openclaw
- 公式サイト: https://openclaw.ai
- ドキュメント: https://docs.openclaw.ai
- Gateway architecture: https://docs.openclaw.ai/concepts/architecture
- Agent runtime: https://docs.openclaw.ai/concepts/agent
- Agent loop: https://docs.openclaw.ai/concepts/agent-loop
- Plugin internals: https://docs.openclaw.ai/plugins/architecture
- Multi-agent routing: https://docs.openclaw.ai/concepts/multi-agent
- VISION.md: https://github.com/openclaw/openclaw/blob/main/VISION.md
- CONTRIBUTING.md: https://github.com/openclaw/openclaw/blob/main/CONTRIBUTING.md
- ClawHub（Skills レジストリ）: https://clawhub.ai
- DeepWiki: https://deepwiki.com/openclaw/openclaw
- アーキテクチャ解説（外部）: https://bibek-poudel.medium.com/how-openclaw-works-understanding-ai-agents-through-a-real-architecture-5d59cc7a4764
