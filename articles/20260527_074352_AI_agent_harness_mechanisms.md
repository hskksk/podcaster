# AIエージェントに対するハーネスの機構とOSS実装

## 概要

AIエージェントの「ハーネス（Harness）」とは、LLMそのものではなく、モデルを取り巻く実行基盤全体を指す。OpenAI CodexチームやAnthropicが2025〜2026年に提唱した **Agent = Model + Harness** という式が、現在のエージェント設計の中心概念になっている。

ハーネスには大きく2つのレイヤーがある。

1. **ハーネス機構（Mechanism）**: エージェントのライフサイクルに介入する「仕組み」そのもの。Hooks、Middleware、Sandbox、Permission Gate、Checkpoint など。OpenCode の `tool.execute.before` のような、プラットフォームが提供する拡張ポイントがこれに当たる。
2. **ハーネス内容（Content/Policy）**: その機構を通じて実際に適用される具体的なルール・振る舞い。例えば「`.env` ファイルの読み取りを禁止する」「編集後に typecheck を走らせる」「Plan フェーズでは bash ツールをマスクする」など。

ユーザーが挙げた OpenCode は前者（機構）を豊富に持つが、後者（目的特化のポリシー）は含まない **汎用エージェントランタイム** である。対照的に SWE-agent、Manus、oh-my-opencode のような **特定目的エージェント** は、同じ機構の上にドメイン固有のハーネス内容を厚く載せている。

本レポートでは、(A) ハーネス機構の分類と各OSSでの実装、(B) 特定目的エージェントが載せている具体的ハーネス内容、(C) 設計原則と最新動向を体系的に整理する。

---

## 背景・歴史

### エージェントフレームワークからハーネスへの進化

初期の LLM エージェント開発は LangChain や AutoGPT のような **フレームワーク** 層が中心だった。フレームワークは「チェーン」「ツール呼び出し」「メモリ」の **部品（primitives）** を提供するが、本番で安定動作させるための **運用設計** は開発者任せだった。

2025年以降、Claude Code・Cursor Agent・OpenAI Codex CLI・OpenCode など **コーディングエージェント製品** が成熟するにつれ、業界の焦点はフレームワークから **ハーネス** へ移った。Addy Osmani、Viv Trivedy（HumanLayer）、Anthropic エンジニアリングチームが相次いで「Harness Engineering」を体系化し、2026年には NVIDIA Elements が Enterprise 向けに Harness Guidelines を公開した。

### なぜ「機構」と「内容」の分離が重要か

同じ Hook 機構でも、載せる内容はプロジェクトごとに異なる。

- OpenCode 本体: `tool.execute.before` で引数改変・実行ブロックが **できる**
- oh-my-opencode プラグイン: 同じ Hook に **52種類の具体ロジック**（AGENTS.md 自動注入、TODO 強制完了、出力トランケーション等）を載せる
- ユーザーの `.cursor/hooks.json`: プロジェクト固有の lint/test ゲートを載せる

つまり **機構は再利用可能なインフラ**、**内容は失敗履歴から蓄積されるポリシー** である。Böckeler の Guides/Sensors フレームワーク（Feedforward/Feedback）もこの分離を説明している。

---

## 核となる概念

### ハーネス機構の5本柱

All-The-Vibes/Agent-Harness や LangChain Deep Agents のドキュメントが共通して挙げる柱:

| 柱 | 保証するもの | 代表機構 |
|---|---|---|
| Context Assembly | 各ターンで最適なコンテキストを構築 | Rules/AGENTS.md、Skills、Memory、Compaction |
| Tool Integrity | ツール呼び出しのスキーマ検証・実行制御 | Tool Registry、Permission Gate、Sandbox |
| Loop Discipline | いつ続行・停止・リトライするか | maxTurns、Stop Hook、Ralph Loop、Checkpoint |
| Policy Enforcement | 副作用前の許可/拒否 | PreToolUse Hook、HITL Middleware、OPA |
| Context Lifecycle | 有限なコンテキスト窓の管理 | Compaction、Offloading、Session Reset |

### 3層スタックモデル

its-boris.com や Curate-Me が整理する **Framework / Harness / Gateway** 3層:

```
[Gateway]  ← 組織横断ポリシー（レート制限、PII スキャン、監査）
    ↓
[Harness]  ← 単一エージェントの実行ループ・ツール・メモリ
    ↓
[Framework] ← LangChain/LangGraph 等の primitives
    ↓
[Model]
```

Gateway 層のポリシーは Harness 内 Hook だけでは組織全体に及ばない、という議論も重要である（Ranjan Kumar の Dual-Layer Gate Model: Global Policy + Per-Agent Gate）。

### Feedforward と Feedback（Guides / Sensors）

| 方向 | 名称 | 機構 | 例 |
|---|---|---|---|
| Feedforward | Guides | 行動前に正しい入力を与える | CLAUDE.md、Skills、SessionStart Hook でのコンテキスト注入 |
| Feedback | Sensors | 行動後に出力を検証する | PostToolUse Hook で lint、Stop Hook でテスト、Evaluator Subagent |

Anthropic の長時間タスクハーネスは **Generator-Validator 分離**（自己評価バイアス回避）を Feedback 層の中核としている。

---

## 詳細な仕組み・理論：ハーネス機構の分類

### 1. Lifecycle Hooks（ライフサイクルフック）

最も普及したハーネス機構。エージェントループの **決定論的介入点** を提供する。

#### 共通パターン

```
User Prompt → [BeforeAgent/UserPromptSubmit] → Model Think → [PreToolUse] → Tool Execute → [PostToolUse] → ... → [Stop/AfterAgent] → Session End
```

#### 各OSSの Hook イベント比較

| イベント | Claude Code | Cursor | OpenCode Plugin | Codex CLI | Gemini CLI |
|---|---|---|---|---|---|
| セッション開始 | SessionStart | sessionStart | event (session.created) | SessionStart | SessionStart |
| プロンプト前 | UserPromptSubmit | beforeSubmitPrompt | chat.message | — | BeforeAgent |
| ツール実行前 | PreToolUse | preToolUse | tool.execute.before | PreToolUse | BeforeTool |
| ツール実行後 | PostToolUse | postToolUse | tool.execute.after | PostToolUse | AfterTool |
| サブエージェント | SubagentStart/Stop | subagentStart/Stop | (parentAgent 提案中) | — | — |
| コンパクション前 | PreCompact | preCompact | experimental.session.compacting | — | — |
| 停止/完了 | Stop | stop | session.idle | Stop | AfterAgent |
| シェル専用 | — | beforeShellExecution | shell.env | — | — |
| MCP 専用 | — | beforeMCPExecution | permission.ask | — | — |
| ツール選択前 | — | — | tool.definition | — | BeforeToolSelection |

#### Hook ハンドラの種類（Claude Code が最も成熟）

Claude Code SDK は5種類のハンドラをサポート:

1. **command**: シェルスクリプト（stdin に JSON、exit code で制御）
2. **prompt**: LLM に判断させる（Haiku 等）
3. **agent**: サブエージェントを起動して codebase を調査してから判断（実験的）
4. **http**: HTTP エンドポイント（TrueFoundry 等の Gateway 連携）
5. **mcp_tool**: MCP ツール呼び出し

OpenCode は TypeScript 関数ベース。`throw new Error()` でブロック、`output.args` 直接改変で入力変更。

#### OpenCode Plugin Hook 一覧（汎用ランタイムの代表）

| Hook | タイミング | 変更可能 |
|---|---|---|
| config | 設定読込後 | Config 全体 |
| chat.message | メッセージ受信時 | メッセージ |
| chat.params | LLM 呼出前 | temperature 等 |
| permission.ask | 権限要求時 | allow/deny |
| tool.execute.before | ツール実行前 | 引数、ブロック |
| tool.execute.after | ツール実行後 | 出力 |
| tool.definition | ツール登録時 | description/schema |
| command.execute.before | スラッシュコマンド前 | 引数 |
| shell.env | シェル実行前 | 環境変数 |
| experimental.session.compacting | 圧縮前 | 保持コンテキスト |
| experimental.text.complete | 生成完了後 | テキスト |
| event | 全イベント | 観察のみ |

OpenCode は **機構は豊富だが具体ポリシーはプラグイン/ユーザーが載せる** 設計。GitHub Issue #20387 では Claude Code の `type: "agent"` Hook（PreToolUse 時にサブエージェントを起動して分析結果を注入）の実装が議論されているが、現状 OpenCode では `output.inject()` 静的注入のみ。

### 2. Rules / Instructions Files（永続指示ファイル）

モデル起動時または各ターンで注入される **Feedforward 層** の中核。

| ファイル | 主な利用者 | スコープ |
|---|---|---|
| AGENTS.md | Codex, Copilot, Cursor, Windsurf, Aider, Deep Agents | プロジェクト（Linux Foundation 標準化） |
| CLAUDE.md | Claude Code | プロジェクト + ユーザー + managed policy |
| .cursor/rules/*.md | Cursor | trigger: always_on / model_decision / glob / manual |
| .windsurf/rules/*.md | Windsurf Cascade | 同上 + enterprise system rules |
| .aider/conventions.md | Aider | プロジェクト conventions |
| SOUL.md / MEMORY.md | OpenClaw 系 | エージェント人格・長期記憶 |

**AGENTS.md のディスカバリ（Codex）**: グローバル `~/.codex/AGENTS.md` → プロジェクト root から cwd までの各ディレクトリを root-down で走査。近いディレクトリの指示が後から連結され **上書き優先** になる。デフォルト上限 32 KiB。

**Windsurf の AGENTS.md 自動スコープ**: root の AGENTS.md は always_on、サブディレクトリの AGENTS.md は glob `/**` として自動適用。

### 3. Skills（オンデマンド能力パッケージ）

Agent Skills オープン標準（agentskills.io）に基づく `SKILL.md` ディレクトリ。

**Progressive Disclosure（段階的開示）**:
1. Startup: name + description のみ（~100 tokens/skill）
2. Activation: 全文 SKILL.md（<5000 tokens 推奨）
3. On demand: scripts/, references/, assets/

Claude Code 拡張フィールド:
- `context: fork` → サブエージェントコンテキストで実行
- `agent: Explore` → 使用するサブエージェント種別
- `hooks` → スキルスコープの Hook
- `disable-model-invocation` → 手動 `/skill-name` のみ

Cursor Skills も Hooks を内包可能（nightly）。Skills は Rules（常時注入）と対比して **動的ロード** される点がハーネス設計の核心。

### 4. Subagents / Multi-Agent Orchestration（委譲・分離）

コンテキスト窓を保護し、専門化する機構。

| OSS | 機構 | 分離方法 |
|---|---|---|
| Claude Code | .claude/agents/*.md, Task tool | 独立 context、tools/disallowedTools 制限 |
| Cursor | Task tool | subagentStart/Stop Hook |
| GitHub Copilot SDK | customAgents[] | infer による自動委譲、agent-exclusive tools |
| OpenCode | TaskTool, Session.create(parentID) | セッション親子関係 |
| Deep Agents | task tool + SubAgentMiddleware | エフェメラル child agent、単一レポート返却 |
| Devin | Brain → Editor/Shell/Browser/Error agents | 階層型、VM 内実行 |
| Manus | Planner + Executor | Plan-Act、Docker sandbox per task |
| oh-my-opencode | Sisyphus + @oracle/@librarian 等 | キーワード検出で specialist 起動 |

**Explore/Plan 組み込み subagent（Claude Code）**: CLAUDE.md と git status を **意図的にスキップ** して context を小さく保つ。これ自体がハーネス内容（「調査タスクでは conventions より速度優先」）。

### 5. Middleware（フレームワーク層の介入）

LangChain/LangGraph 系で Hook に相当する **プログラマブル介入**。

| Middleware | 機能 |
|---|---|
| HumanInTheLoopMiddleware | interrupt_on でツール実行前に停止、Command(resume=...) で再開 |
| FilesystemMiddleware | 仮想 FS ツール + 大出力の自動 evict |
| SubAgentMiddleware | task ツール提供 |
| SummarizationMiddleware | コンテキスト圧縮 |

LangGraph の `interrupt_before` / `interrupt()` + Checkpointer（MemorySaver/PostgresSaver）が HITL の基盤。Middleware は Hook より **型安全で composable** だが、エンドユーザー設定ファイルとしては Hook ほど普及していない。

Deep Agents の **HarnessProfile**: provider/model ごとに excluded_tools、system prompt tweak、middleware 設定を宣言的バンドル化。

### 6. Sandbox / Permission / Tool Governance

副作用を物理的に制限する **Policy Enforcement 層**。

| 実装 | 方式 |
|---|---|
| Claude Code | Seatbelt (macOS) / bubblewrap (Linux)、permission mode (default/plan/acceptEdits/bypassPermissions) |
| Gemini CLI | Docker/Podman/gVisor/LXC/sandbox-exec |
| OpenClaw | Docker/SSH/OpenShell backend、tools.elevated で escape hatch |
| Devin | セッション毎 VM、AES-256 at rest |
| Cursor | Sandbox + Hooks の defense in depth |
| Manus | タスク毎 Docker、Chrome+VNC+Shell |

**動的ツールスコーピング**（Vercel 事例: ツール80%削減で品質向上）: フェーズ毎に利用可能ツールを絞る。Manus は **logits マスキング** で decode 時に特定ツール群のみ選択可能にする state machine を採用（ツールの動的追加/削除は避ける方針）。

**MCP Governance**: tools/list レスポンスのフィルタリング、per-tool rate limit、server allowlist。MCP Gateway が JSON-RPC レベルで介入。

### 7. Memory / Persistence / Checkpoint

| 機構 | 用途 | 例 |
|---|---|---|
| Auto Memory (Claude Code) | セッション横断の自動記憶 | MEMORY.md |
| Cascade Memories (Windsurf) | workspace スコープの自動/手動記憶 | ~/.codeium/windsurf/memories/ |
| Checkpoint (LangGraph) | 中断・再開 | thread_id + PostgresSaver |
| File-based state (Manus) | ファイルシステムを ultimate context | 無限サイズの外部メモリ |
| compaction + handoff file (Anthropic) | 長時間タスクの context reset | 構造化引継ぎドキュメント |

### 8. Verification Loops / Evaluators（検証ループ）

| パターン | 説明 | 採用例 |
|---|---|---|
| PostToolUse Sensor | 編集毎に lint/typecheck | Claude Code Hooks, oh-my-opencode |
| Stop Sensor | タスク完了時に test suite | Cursor grind.ts Hook |
| Generator-Validator | 独立 evaluator subagent | Anthropic long-running harness |
| ACI Linter | 編集前に構文検証 | SWE-agent |
| Closed-loop (Codex team) | 100万行生成の品質担保 | pre-commit + custom linter |

**成功は静か、失敗は詳細に**（HumanLayer 原則）: typecheck 成功時は無出力、失敗時のみエラーテキストを loop に注入。

### 9. Planning / State Machine（計画・状態管理）

| OSS | 計画機構 |
|---|---|
| Devin 2.0 | Scan → Plan → Review → Execute（ユーザー承認） |
| Manus | PlanAct: Planner Agent → Executor Agent |
| Deep Agents | write_todos ツール |
| Claude Code | Plan subagent + plan file on disk |
| OpenClaw | Cron/wakeups + heartbeat |

### 10. Observability / Audit

Hook による JSONL 監査ログ、Gateway 層の immutable audit trail、processing_logs（本プロジェクト）、OpenClaw の `openclaw security audit` コマンド。

---

## 具体例・応用事例

### 汎用ランタイム vs 目的特化エージェント

#### OpenCode（汎用）— 機構のみ

OpenCode 本体が提供するのは:
- Plugin Hook API（上記11種）
- Permission システム（permission.ask）
- Session/Task による subagent
- MCP 統合
- Compaction

**含まないもの**: コーディング特化の lint ゲート、AGENTS.md 自動注入、TODO 強制完了、specialist routing。これらは oh-my-opencode 等の **プラグインが載せる内容**。

#### oh-my-opencode — 同一機構への厚いハーネス内容

OpenCode Plugin として **52 lifecycle hooks** を実装。カテゴリ別:

| カテゴリ | Hook 例 | 具体的内容 |
|---|---|---|
| Context Injection | directory-agents-injector, directory-readme-injector | ファイル read 時に AGENTS.md/README.md を path 走査で自動注入 |
| Productivity | keyword-detector, auto-slash-command | `ultrawork`/`ulw` キーワードで並列実行モード切替 |
| Quality | comment-checker, thinking-block-validator | 過剰コメント防止、thinking block 検証 |
| Recovery | anthropic-context-window-limit-recovery | トークン上限で自動 compact |
| Truncation | tool-output-truncator | 巨大出力の truncation |
| Continuation | todo-continuation-enforcer | 全 TODO 完了まで Stop を阻止 |
| Compaction | compaction-context-injector | 圧縮時に重要 context 保持 |

さらに **26 tools**、**IntentGate classifier**、**Sisyphus orchestrator agent**、specialist agents（@oracle, @librarian）を bundled。これが「OpenCode は機構、oh-my-opencode は内容」の典型例。

#### SWE-agent — ACI（Agent-Computer Interface）としてのハーネス内容

SWE-agent の核心は **汎用 bash ではなく SWE 特化 ACI** を設計すること:

1. **Linter Gate**: edit コマンド発行時、構文エラーなら edit を拒否
2. **File Viewer**: cat ではなく 100行/turn のページング viewer（scroll, search）
3. **Search Commands**: find_file, search_dir — 結果を簡潔に（verbose は model を混乱）
4. **Empty Output Feedback**: 出力なしでも "Your command ran successfully..." を返す
5. **YAML Config**: tools bundles, prompt templates, demonstrations

論文 (NeurIPS 2024) では ACI なし baseline より大幅改善。ACI は Hook ではなく **ツール設計 + フィードバックフォーマット** としてハーネスを実現。

#### Devin — 製品一体型ハーネス

| 層 | 内容 |
|---|---|
| Brain (Cognition Cloud) | 推論、計画、サブエージェント委譲 |
| DevBox (VM) | Shell, Editor, Browser, Docker |
| Interactive Planning | ユーザー承認前に plan review |
| Knowledge Base | セッション横断の file-based memory |
| Error Handler Agent | 失敗分析 → 反復修正 |
| Enterprise | VPC Private Link, audit API |

**Claude Code との対比** (llm-safe-haven): Devin は user-defined hooks 非対応、代わりに VM 隔離 + Secrets Vault。Claude Code は hooks 豊富だが local execution。

#### Manus — Context Engineering としてのハーネス

Manus 公式ブログの教訓:
- ツールの動的追加/削除は避け、**logits マスキング** で state-dependent tool availability
- ツール名の prefix 規約（browser_, shell_）で group 制約
- **ファイルシステム = ultimate context**（サイズ無制限、永続、agent 自身が R/W）
- Context 設計は "Stochastic Graduate Descent" — 4回 framework rebuild

#### LangChain Deep Agents — オープンソースハーネスフレームワーク

4カテゴリ:
1. **Execution Environment**: Tools, Virtual FS, Sandbox, REPL
2. **Context Management**: Skills, Memory (AGENTS.md), Summarization, Prompt Caching
3. **Delegation**: write_todos, task (subagents)
4. **Steering**: interrupt_on (HITL)

`tool_token_limit_before_evict`（デフォルト 20,000 tokens）で大出力を FS に evict — Manus/OpenCode と同型の context lifecycle 機構。

#### GitHub Copilot (VS Code) — モデル横断ハーネス

VS Code 2026 blog より:
- モデル毎に instructions/tools を **evals でチューニング**
- Tool exposure は request 毎に変動（tool picker, MCP, custom agents）
- VSC-Bench: harness が workspace + prompts + tool calls を end-to-end 評価

`.agent.md` custom agents: tools 制限、MCP attach、subagent 委譲。

---

## 重要人物・文献

| 人物/組織 | 貢献 |
|---|---|
| Viv Trivedy (HumanLayer) | "Agent = Model + Harness", Terminal Bench 改善事例 |
| Addy Osmani | Harness Engineering 総合解説、Ratchet 原則 |
| Anthropic Engineering | Long-running agent harness, Generator-Validator |
| Birgitta Böckeler (Thoughtworks) | Guides/Sensors フレームワーク |
| John Yang et al. | SWE-agent, ACI 概念 (NeurIPS 2024) |
| Peak Ji (Manus) | Context Engineering for AI Agents |
| NVIDIA Elements Team | Project Harness vs Domain Harness |
| Linux Foundation | AGENTS.md 標準化 |

### 主要論文・記事

- SWE-agent: "Agent-Computer Interfaces Enable Software Engineering Language Models" (arXiv:2405.15793)
- Manus: "Context Engineering for AI Agents: Lessons from Building Manus"
- Anthropic: "Effective harnesses for long-running agents"
- Agent Skills Specification: https://agentskills.io/specification

---

## 最新動動向・未解決問題

### 2026年の収束トレンド

1. **Hook 標準化の萌芽**: AgentsMesh が `.agentsmesh/hooks.yaml` で Claude Code / Cursor / Windsurf / Gemini CLI / Codex 向けに canonical config を生成。TrueFoundry が `/api/llm/guardrail` 統一 API を提案。
2. **AGENTS.md の業界標準化**: Codex, Copilot, Cursor, Windsurf, Aider, Deep Agents が採用。HarnessForge 等の自動生成ツール出現。
3. **Agent-type Hook**: Claude Code の `type: "agent"` hook — PreToolUse 時に subagent が codebase を調査して structured context を返す。OpenCode は feature request 段階。
4. **Harness-as-a-Service**: Claude Agent SDK, Codex SDK, OpenAI Agents SDK — loop + tools + hooks + sandbox を API 提供。
5. **Harness Profile**: Deep Agents, OpenClaw plugin runtime selection — model/provider 毎の宣言的チューニング。

### 未解決問題

| 問題 | 現状 |
|---|---|
| クロスハーネス統一ガバナンス | Gateway 層は成熟途上、Hook だけでは fleet-wide enforcement 不可 |
| Hook の agent spawn | OpenCode #20387 — reactive sub-agent in hook 未実装 |
| 動的ツール vs 性能 | Manus: 動的追加は避け、マスキングで妥協 |
| プロンプトインジェクション | MCP tool description, untrusted file content — どの harness も完全防御なし |
| ハーネスの陳腐化 | モデル改善で assumption が変わる — Anthropic: "harnesses don't shrink, they move" |
| Self-improving harness | エージェントが自身の trace から harness を修正 — 研究段階 |

---

## 関連トピック

- **MCP (Model Context Protocol)**: ツール/リソース/プロンプトの標準化。Harness の tool 層を外部化
- **Context Engineering**: Harness の feedforward 設計。Event-driven injection（Agent RuleZ, oh-my-opencode directory injector）
- **Agent Gateway / AI Control Plane**: Harness の外側の組織ポリシー層
- **Agent-Computer Interface (ACI)**: SWE-agent 発の、ツール+フィードバック設計としての harness
- **Ralph Loop / Grind Hook**: Stop hook で followup_message を返し、テスト pass まで継続
- **Evals-driven Harness Tuning**: Copilot VSC-Bench, Terminal Bench 2.0

---

## 設計原則まとめ（実践的チェックリスト）

1. **Ratchet**: 失敗 → ルール/Hook/テスト に変換。AGENTS.md の各行は過去の失敗に traceable
2. **Guides before Sensors**: まず CLAUDE.md/AGENTS.md、次に Hook
3. **Hooks for enforcement, Rules for guidance**: CLAUDE.md は「読んでも無視される」、Hook は物理実行
4. **Generator ≠ Evaluator**: 自己評価バイアス回避のため独立 evaluator
5. **Success silent, failure verbose**: 検証成功は無出力
6. **Progressive disclosure**: Skills/MCP は on-demand。起動時に全ロードしない
7. **Tool budget**: フェーズ毎にツールを絞る（dynamic scoping / logits masking）
8. **Filesystem as memory**: 長時間タスクは context ではなく FS に state
9. **Mechanism vs Content 分離**: 汎用 runtime を選び、ドメイン policy を layered に載せる

---

## 参考リンク

### 概念・総論
- https://addyosmani.com/blog/agent-harness-engineering/
- https://harness-engineering.ai/blog/agent-harness-complete-guide/
- https://nvidia.github.io/elements/docs/internal/guidelines/agent-harness/
- https://its-boris.com/blog/framework-harness-gateway-agent-stack
- https://docs.curate-me.ai/blog/agent-harness-vs-gateway

### Hook ドキュメント
- https://code.claude.com/docs/en/hooks
- https://cursor.com/docs/hooks
- https://developers.openai.com/codex/hooks
- https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md
- https://open-code.ai/en/docs/plugins
- https://github.com/joshuadavidthomas/opencode-plugins-manual/blob/main/docs/04-hooks-reference.md

### OSS プロジェクト
- https://github.com/anomalyco/opencode
- https://github.com/code-yeongyu/oh-my-opencode (oh-my-openagent)
- https://github.com/SWE-agent/SWE-agent
- https://github.com/langchain-ai/deepagents
- https://github.com/openai/codex
- https://docs.openclaw.ai/plugins/sdk-agent-harness

### 標準・ガイド
- https://agentskills.io/specification
- https://developers.openai.com/codex/guides/agents-md
- https://docs.windsurf.com/windsurf/cascade/agents-md
- https://docs.langchain.com/oss/python/deepagents/harness
- https://docs.langchain.com/oss/python/langchain/human-in-the-loop

### 特定目的エージェント
- https://manus.im/en/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
- https://docs.devin.ai/enterprise/deployment/overview
- https://swe-agent.com/latest/background/aci/
- https://code.visualstudio.com/blogs/2026/05/15/agent-harnesses-github-copilot-vscode

### 日本語
- https://claudelab.jp/articles/716
- https://lzw.me/docs/opencodedocs/code-yeongyu/oh-my-opencode/advanced/lifecycle-hooks/
