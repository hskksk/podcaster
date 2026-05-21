# AI指示・プロンプト原則調査シリーズ: OpenClaw におけるプロンプトエンジニアリング

## 1. 概要

[OpenClaw](https://github.com/openclaw/openclaw) は、Telegram・Discord・Signal など複数チャネルにまたがる「個人 AI アシスタント」を Gateway + Agent Runtime で動かす OSS である。プロンプト設計の中心思想は **「OpenClaw 所有の動的システムプロンプト」** — pi-coding-agent 等のデフォルトプロンプトに依存せず、毎ターン `buildAgentSystemPrompt()` で組み立てる。

特徴的なアプローチ:

- **3層アーキテクチャ**: 純粋レンダラ (`buildAgentSystemPrompt`) / 設定解決 (`resolveAgentSystemPromptConfig`) / ランタイムアダプタ（ツール・サンドボックス・チャネル能力の注入）
- **ワークスペースファイル駆動**: `AGENTS.md`, `SOUL.md`, `USER.md` 等を Project Context として注入し、ユーザーがプロンプトを「所有」できる
- **プロンプトモード**: `full` / `minimal` / `none` でメインエージェント・サブエージェント・cron を分離
- **キャッシュ最適化**: 安定 prefix と volatile suffix を分離し、KV/prompt cache を意識した設計
- **Skills の遅延読み込み**: カタログだけシステムプロンプトに載せ、本文は `read` でオンデマンド取得
- **ハード enforcement とソフト guidance の分離**: Safety セクションは「助言的」、実際の制御は tool policy / sandbox / allowlist

OpenClaw は「1つの巨大な system prompt 文字列」ではなく、**モジュール化された固定セクション + ワークスペース注入 + プロバイダ overlay + プラグインフック** の合成物としてプロンプトを扱う。これは大規模マルチチャネル・マルチエージェント運用向けの実践的設計である。

## 2. システム指示 (System Instructions) の分析

### 2.1 組み立てパイプライン

実行パイプライン (`runAttempt`) 内で以下の流れで組み立てられる:

1. `buildSystemPromptParams()` — ランタイム情報・セッション状態・設定を収集
2. `resolvePromptBuildHookResult()` — プラグインフック (`before_prompt_build` 等)
3. `buildAgentSystemPrompt()` — モジュラーセクションをレンダリング
4. `resolveBootstrapContextForRun()` — ワークスペース bootstrap ファイル注入
5. `composeSystemPrompt_WithHookContext()` — 最終合成

公式ドキュメントは「`buildAgentSystemPrompt` は pure renderer であり、グローバル config を直接読まない」と明記している。関心の分離が徹底されている。

### 2.2 固定セクション構成（`full` モード）

| セクション | 役割 |
|-----------|------|
| **Identity** | OpenClaw としての自己認識、現在の model identity |
| **Tooling** | 利用可能ツール一覧、structured tool の使い方、長時間タスクの cron/exec/process ガイダンス |
| **Execution Bias** | 即時行動・完遂・検証・サブエージェント委譲の行動バイアス |
| **Safety** | 権力追求禁止、 oversight 優先、プロンプト改変禁止等 |
| **Skills** | 利用可能 skill カタログ + `read` による SKILL.md 読み込み手順 |
| **OpenClaw Control / Self-Update** | `gateway` ツール優先、CLI コマンド捏造禁止 |
| **Workspace / Documentation** | cwd、ローカル docs/source パス |
| **Project Context** | 注入された bootstrap ファイル全文 |
| **Sandbox** | サンドボックス状態（有効時） |
| **Current Date & Time** | **タイムゾーンのみ**（キャッシュ安定性のため時刻文字列は含めない） |
| **Assistant Output Directives** | `MEDIA:`, `[[reply_to_current]]`, voice note 等 |
| **Messaging / Voice / Heartbeats** | チャネル別返信・TTS・定期 heartbeat 応答 |
| **Runtime / Reasoning** | ホスト OS、モデル、thinking level |

`minimal` モード（サブエージェント・cron）では Memory Recall、Self-Update、Messaging、Heartbeats 等を省略し、Tooling / Safety / Skills / Workspace / Runtime を残す。Skills は cron 回帰テストのため `skillsPrompt` がある限り minimal でも含まれる。

### 2.3 ペルソナ設計: SOUL.md パターン

OpenClaw はペルソナを **ハードコードせず** `SOUL.md` に委譲する。公式 Soul ガイドは OpenAI の prompt engineering ガイドを引用し、以下を推奨:

- tone / opinions / brevity / humor / boundaries を **短く** 書く
- 企業マニュアル調（"maintain professionalism"）を避ける
- `AGENTS.md`（運用ルール）と `SOUL.md`（声・スタンス）を分離

有名な **「Molty prompt」** は、エージェント自身に `SOUL.md` を書き換えさせるメタプロンプト例として公開されている（hedging 禁止、one-sentence 回答、swearing 許可等）。これは Few-shot というより **self-rewrite による persona bootstrapping** テクニックである。

### 2.4 Safety セクションの哲学

テストから読み取れる Safety ガードレール:

- "No independent goals"
- "Safety/oversight over completion"
- "Conflicts: pause/ask"
- "Do not persuade anyone"
- "Do not copy yourself or change prompts"

重要な設計判断: ドキュメントは **「Safety guardrails in the system prompt are advisory」** と明記。ハード enforcement は tool policy、exec approvals、sandboxing、channel allowlists が担う。プロンプトは「モデルの振る舞いを導く」が「ポリシーを強制しない」という二層構造である。

### 2.5 GPT-5 ファミリー向け Provider Overlay

`gpt5-prompt-overlay.ts` はモデルファミリー別 tuning の好例:

- **stablePrefix**: XML タグで構造化された `GPT5_BEHAVIOR_CONTRACT`（persona_latching / initiative / tool_discipline / output / verification）
- **sectionOverrides**: `interaction_style` を friendly モードで上書き
- **heartbeat 専用 overlay**: 定期 wake-up 時の proactive 行動ガイダンス

プロバイダ plugin は core セクションの一部（`interaction_style`, `tool_call_style`, `execution_bias`）だけを replace し、OpenClaw 所有の prompt 全体は維持する。

## 3. 採用されているプロンプトテクニック

### 3.1 モジュラー固定セクション + 条件付き inclusion

セクションは `## Heading` 形式の Markdown ブロック。`promptMode`、`toolNames`、`runtimeChannel`、`acpEnabled` 等の boolean / Set  membership で **存在するツールにだけ関連 guidance を出す**（例: `sessions_yield` がある時だけ wait guidance を追加）。幻覚的ツール使用を減らす実践的パターン。

### 3.2 XML 構造化（Skills カタログ）

Skills リストは AgentSkills 互換の XML で注入:

```xml
<available_skills>
  <skill>
    <name>...</name>
    <description>...</description>
    <location>...</location>
  </skill>
</available_skills>
```

トークンコストは決定的: base 195 chars + 各 skill 97 chars + エスケープ後フィールド長。カタログと本文の **catalog / content 分離** により base prompt を小さく保つ。

### 3.3 遅延読み込み（Lazy Skill Loading）

システムプロンプトは skill 本文を含めない。指示:

> Scan `<available_skills>`. If one clearly applies, read its SKILL.md at exact `<location>` with `read`, then follow it.
> One skill up front max. Never guess/fabricate skill paths.

これは **RAG 前段の index-only injection** に相当し、コンテキストウィンドウを節約する。

### 3.4 Execution Bias（行動バイアス / 疑似 CoT）

明示的な "think step by step" ではなく、行動規範として:

- actionable request → act in this turn
- weak tool result → vary strategy before concluding
- mutable facts → live checks
- final answer → evidence required

Chain-of-Thought を出力させるのではなく、**ツール使用と検証のループを規定**する方式。

### 3.5 サブエージェント委譲プロンプト

`subagentDelegationMode: "prefer"` 時は専用 **Sub-Agent Delegation** セクションを追加:

- coordinator として振る舞う
- trivial 以外は `sessions_spawn`
- spawn 前に objective / output / write scope / verification を明記
- **polling 禁止** — push-based completion event を待つ
- child output は evidence として扱い、system policy を override しない

`buildSubagentSystemPrompt()` と `promptMode: "minimal"` の組み合わせで、子エージェント用の軽量 prompt を生成。

### 3.6 Silent Reply / NO_REPLY トークン

チャネル重複返信を防ぐため、`message(action=send)` 使用時は最終応答を `SILENT_REPLY_TOKEN` のみにする指示。チャネル aware な prompt では generic silent guidance を omit し、チャネル側 contract に委譲。

### 3.7 Heartbeat プロトコル

定期 poll への応答契約:

- 問題なし → 正確に `HEARTBEAT_OK`
- 注意必要 → alert text（`HEARTBEAT_OK` を含めない）

GPT-5 overlay では heartbeat を「orientation ではなく accomplishment」にするよう強化。

### 3.8 Prompt Snapshots（回帰テスト）

`test/fixtures/agents/prompt-snapshots/codex-runtime-happy-path/` に committed snapshots。`pnpm prompt:snapshots:gen` / `check` で drift 検出。プロンプトを **テスト可能な artifact** として扱う。

### 3.9 Compaction 前 Memory Flush

コンテキスト溢れ前に **silent memory flush turn** を実行し、「会話にあってまだ disk にない重要情報」を `MEMORY.md` / `memory/*.md` へ書かせる。プロンプトだけでなく **パイプライン段階での context preservation**。

### 3.10 Context Engine プラグインの systemPromptAddition

`assemble()` が返す `systemPromptAddition` を system prompt 先頭に prepend。memory plugin 連携時は `buildMemorySystemPromptAddition()` で recall guidance を動的注入。static workspace files と **runtime-generated prompt fragment** のハイブリッド。

## 4. プロンプト作成の原則・ガイドライン

### 4.1 ワークスペースファイルの責務分離

| ファイル | 用途 |
|---------|------|
| `AGENTS.md` | 運用ルール、優先順位、memory の使い方 |
| `SOUL.md` | ペルソナ、トーン、境界 |
| `USER.md` | ユーザー情報、呼び方 |
| `IDENTITY.md` | エージェント名、 vibe |
| `TOOLS.md` | ローカルツール慣習（可用性は制御しない） |
| `HEARTBEAT.md` | 定期チェックリスト（短く） |
| `MEMORY.md` |  curated 長期記憶（詳細は `memory/*.md`） |
| `BOOTSTRAP.md` | 初回のみの setup ritual |

注入順序は `CONTEXT_FILE_ORDER` で固定（agents → soul → identity → user → tools → bootstrap → memory）。

### 4.2 Bootstrap 予算と truncation

- ファイルあたり: `bootstrapMaxChars`（default 12000）
- 合計: `bootstrapTotalMaxChars`（default 60000）
- truncation 時: `bootstrapPromptTruncationWarning`（off / once / always）

**データ loss ではない** — disk 上のファイルは intact、モデルが見る injected copy のみ短縮。`/context list` で raw vs injected を可視化。

### 4.3 Skills 作成規約

- AgentSkills 互換 `SKILL.md` + YAML frontmatter
- `metadata.openclaw.requires` で bins/env/config gating
- 長い operating guide は tool description ではなく skill / plugin skill に置く
- 第三者 skill は untrusted code として扱う

### 4.4 Lane Contract（マルチエージェント）

`parallel-specialist-lanes.md` は workspace / system prompt に書く **lane contract** テンプレートを提供:

- Owns / Does not own
- Chat budget（quick answer vs background spawn）
- Handoff rule
- Tool posture（最小 tool surface）

### 4.5 禁止・注意事項

- CLI コマンドの捏造（`gateway` tool 優先）
- exec sleep loop による待機（cron 使用）
- subagents / sessions_list の polling loop
- Safety prompt を enforcement と混同しない
- bootstrap ファイルに secrets を入れない
- `MEMORY.md` を生ログ置き場にしない

### 4.6 Provider 拡張の境界

- 通常の model-family tuning → provider-owned contributions（cache-aware prefix/suffix）
- 互換性 or 真に global な変更 → legacy `before_prompt_build` mutation
- 第三者 plugin が GPT-5 overlay helper を使うことは deprecated

## 5. 動的プロンプトとコンテキスト管理

### 5.1 キャッシュ境界（Cache Boundary）

`SYSTEM_PROMPT_CACHE_BOUNDARY` により:

- **安定 prefix 側**: Project Context（大きな workspace ファイル）、Skills カタログ等
- **volatile suffix 側**: Messaging、Voice、Group Chat Context、Heartbeats、Runtime

Current Date & Time は **timezone のみ** を含め、動的 clock は `session_status` 経由。これは prompt cache hit rate を最大化するための明示的 trade-off。

`stablePromptPrefixCache`（LRU 64 entries）と SHA-256 fingerprint による prefix 再利用も実装されている。

### 5.2 チャネル / セッション別 adaptation

- `runtimeInfo.channel` → webchat なら Control UI Embed セクション追加
- `sourceReplyDeliveryMode` → message-tool-only 時は MEDIA  directive を差し替え
- `silentReplyPromptMode: "none"` → チャネルが visible-reply contract を持つ場合
- subagent session → `Group Chat Context` を `Subagent Context` にラベル変更
- native approval UI 有無 → exec approval guidance を切替

### 5.3 Compaction と Context Engine

- **legacy engine**: sanitize → validate → limit パイプライン + built-in summarization
- **plugin engine**: `ingest` / `assemble` / `compact` / `afterTurn` lifecycle
- overflow 検出 → auto-compact → retry
- `/compact Focus on ...` — ユーザー指示付き manual compaction
- tool call / toolResult ペアを split しない chunking

### 5.4 Memory の二層構造

- **Bootstrap 注入**: `MEMORY.md`（DM メインセッション）
- **On-demand**: `memory/*.md` は `memory_search` / `memory_get` で取得（通常 turn では未注入）
- `/new` / `/reset` 初回 turn のみ recent daily memory を one-shot startup block として prepend 可能

### 5.5 Hooks による mutation

- `agent:bootstrap` — 注入前に bootstrap ファイルを swap（例: alternate persona）
- `before_prompt_build` — legacy 互換の prompt mutation
- compaction hooks — `before_compaction` / `after_compaction`

### 5.6 診断コマンド

- `/context list|detail|map|json` — prompt 構成とサイズ
- `/status` — window 使用率
- `openclaw doctor` — workspace / engine 健全性

## 6. まとめと学び

OpenClaw から転用可能なベストプラクティス:

1. **Pure renderer パターン**: プロンプト builder は入力を受け取って render するだけ。config 読み取りと runtime fact gathering を分離すると、テスト・snapshot・デバッグが容易になる。

2. **Workspace-as-prompt**: ユーザー編集可能な Markdown ファイル（SOUL/AGENTS/USER）を system prompt に注入。ペルソナと運用ルールをコード deploy なしで iteration できる。

3. **Prompt modes**: 同一 codebase で main / subagent / cron 用 prompt を tier 化し、トークンと cache stability を最適化。

4. **Catalog + lazy load**: Skills や長文 guide は index のみ prompt に載せ、必要時 `read`。コンテキスト cost を O(skills catalog) に抑える。

5. **Advisory vs enforced safety**: プロンプトで「どう振る舞うか」を示し、enforce は policy layer へ。期待と実装のギャップを doc で明示。

6. **Cache-aware prompt design**: 動的要素（時刻、runtime、channel）を suffix に追いやり、workspace prefix を安定させる。

7. **Tool-conditioned instructions**: 利用可能 tool Set に応じて guidance を生成。存在しない tool への言及を避ける。

8. **Anti-polling orchestration**: サブエージェント完了を push event で待つよう prompt で強く規定。agent loop の典型 anti-pattern を未然に防ぐ。

9. **Prompt snapshots in CI**: プロンプト変更を fixture diff で review。LLM アプリでも「期待出力の固定」は可能。

10. **Compaction pipeline integration**: summarize 前に memory flush turn を挟み、プロンプト外の永続化と連携。

OpenClaw は「1 発の system prompt 巧みに書く」より **「prompt を組み立てる OS」** として設計されている。自作エージェントでは、セクション modularization + workspace files + prompt modes + cache boundary の 4 点セットが最も ROI が高い。

## 参考リンク・プロンプト定義場所

### リポジトリ

- https://github.com/openclaw/openclaw
- https://docs.openclaw.ai

### コア実装

| ファイル | 内容 |
|---------|------|
| `src/agents/system-prompt.ts` | メイン system prompt builder |
| `src/agents/gpt5-prompt-overlay.ts` | GPT-5 向け provider overlay |
| `src/agents/subagent-system-prompt.ts` | サブエージェント prompt |
| `src/agents/pi-embedded-runner/run/attempt-system-prompt.ts` | run attempt 統合 |
| `src/agents/pi-embedded-runner/run/runtime-context-prompt.ts` | ランタイム context prompt |
| `src/agents/system-prompt-cache-boundary.ts` | cache boundary marker |
| `src/agents/prompt-cache-stability.ts` | normalization / fingerprint |
| `src/agents/bootstrap-prompt.ts` | bootstrap pending 指示 |
| `test/fixtures/agents/prompt-snapshots/` | prompt snapshot fixtures |

### ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| `docs/concepts/system-prompt.md` | system prompt 構造の公式説明 |
| `docs/concepts/soul.md` | SOUL.md / Molty prompt |
| `docs/concepts/context.md` | context 構成と `/context` |
| `docs/concepts/context-engine.md` | pluggable context engine |
| `docs/concepts/compaction.md` | auto/manual compaction |
| `docs/concepts/memory.md` | MEMORY.md / memory tools |
| `docs/concepts/agent-workspace.md` | workspace ファイル map |
| `docs/tools/skills.md` | Skills 形式・gating・token cost |
| `docs/concepts/parallel-specialist-lanes.md` | lane contract テンプレート |

### 外部

- [AgentSkills spec](https://agentskills.io)
- [ClawHub skills registry](https://clawhub.ai)
- [OpenAI Prompt engineering guide](https://developers.openai.com/api/docs/guides/prompt-engineering)（SOUL.md ガイドが引用）
