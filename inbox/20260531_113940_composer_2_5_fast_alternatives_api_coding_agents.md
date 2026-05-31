# Composer 2.5 Fast に相当するAPI利用可能なコーディングモデル調査

## 概要

Cursor が2026年5月18日にリリースした **Composer 2.5 Fast** は、コスト対速度・精度のバランスが非常に優れたエージェント型コーディングモデルとして注目されている。Artificial Analysis の Coding Agent Index では **62点で3位**（Claude Opus 4.7 max の66点、GPT-5.5 xhigh の65点に次ぐ）を記録しながら、タスクあたりコストは **Fast $0.44 / Standard $0.07** と、上位モデルの **10〜60倍安い** という驚異的なコスト効率を示している。

しかし Composer 2.5（Fast を含む）は **Cursor エコシステム専用** である。公開 API、Hugging Face ミラー、OpenRouter 等のサードパーティゲートウェイ経由での利用は現時点（2026年5月）では提供されていない。Cursor CLI や Cursor SDK（`@cursor/sdk` / `cursor-sdk`）からは `composer-2.5-fast` を指定できるが、いずれも Cursor アカウントと Cursor のランタイム（ハーネス）に依存する。

本レポートは、**「Composer 2.5 Fast と同様に、コスト効率が高く、ソフトウェア開発エージェントから API 等で利用できるモデル」** を多角的に調査した結果をまとめる。調査の結論を先に述べると：

1. **完全一致する代替は存在しない** — Composer 2.5 は Moonshot の Kimi K2.5 をベースに Cursor 独自の post-training（85%の compute）を施したクローズドウェイトモデルである
2. **最も近い「系譜上の代替」は Kimi K2.5 / Kimi K2.6** — 同一ベースチェックポイントのオープンウェイト版。API 経由で OpenCode、Kimi Code CLI、Aider 等から利用可能
3. **コスト効率で最も有力な API 代替は DeepSeek V4 Pro / V4 Flash、Xiaomi MiMo-V2.5** — SWE-bench 80%前後の性能を Opus の 1/10〜1/50 のコストで提供
4. **エージェント基盤は OpenCode + モデルルーティング** が2026年時点の実用的な解 — 75+ プロバイダ対応、タスク別にモデルを切り替える構成が主流

---

## 背景・歴史

### Composer ファミリーの進化

Cursor の Composer シリーズは2025年後半から急速に進化している。

| バージョン | リリース | ベース | 主な特徴 |
|-----------|---------|--------|---------|
| Composer 1 | 2026年2月 | 非公開 | Cursor 初の in-house コーディングモデル |
| Composer 1.5 | 2026年2月 | 非公開 | 推論強化版 |
| Composer 2 | 2026年3月19日 | Kimi K2.5 | オープンソースベース初採用、Frontier 級性能 |
| Composer 2.5 | 2026年5月18日 | Kimi K2.5（同一） | 25倍の synthetic RL タスク、Textual Feedback RL |

Composer 2 リリース時、開発者が内部モデル ID `kimi-k2p5-rl-0317-s515-fast` を発見し、Moonshot AI の Kimi K2.5 ベースであることが判明。Cursor は公式にこれを確認した。

### Kimi K2.5 の位置づけ

Moonshot AI（中国・北京）は2026年1月27日に **Kimi K2.5** を Modified MIT ライセンスでオープンウェイト公開した。

- **アーキテクチャ**: Mixture-of-Experts（MoE）、総パラメータ約1T、推論時アクティブ約32B
- **学習データ**: 約15兆の visual + text 混合トークン
- **特徴**: ネイティブマルチモーダル、Agent Swarm（最大100並列サブエージェント）、Instant / Thinking モード
- **API**: OpenAI 互換（`https://api.moonshot.ai/v1`）、$0.60/M input、$2.50〜$3.00/M output

Cursor はこの K2.5 チェックポイントに対し、**continued pretraining + RL** を施し Composer 2/2.5 を構築。Composer 2.5 では総 compute の **85%** が Cursor 独自の post-training に費やされ、Composer 2 比 **25倍の synthetic タスク** で RL 訓練されている。

### なぜ Composer 2.5 Fast は Cursor 専用なのか

Cursor のビジネスモデル上、Composer は **差別化要因（moat）** として位置づけられている。

- エディタ内 Agent、Background Agent、Cloud Agent でのみ提供
- ウェイト非公開 — セルフホスト不可
- Cursor SDK 経由の programmatic access は存在するが、Cursor API Key と Cursor ランタイムが必要
- 次世代モデルは SpaceXAI の Colossus 2（100万 H100 相当）で **from scratch 訓練** 予定

---

## 核となる概念

### Composer 2.5 Fast の技術的特性

#### Standard vs Fast ティア

Composer 2.5 は同一インテリジェンスで2つの推論ティアを提供する。

| ティア | Input | Output | 用途 | タスクあたりコスト（AA測定） |
|-------|-------|--------|------|---------------------------|
| Standard | $0.50/M | $2.50/M | バックグラウンド Agent、CI | ~$0.07 |
| **Fast（デフォルト）** | **$3.00/M** | **$15.00/M** | 対話型セッション | ~$0.44 |

Fast ティアは Standard 比 **約30%高速**（6.7分 vs 9.3分/タスク）だが、**約6倍のコスト**。トークン単価も6倍差。Fast の本質は「より高い推論スループットを買う」ことであり、別モデルではない。

#### ベンチマーク性能

| ベンチマーク | Composer 2.5 | Claude Opus 4.7 | GPT-5.5 |
|-------------|-------------|-----------------|---------|
| SWE-Bench Multilingual | 79.8% | 80.5% | ~80% |
| CursorBench v3.1 | 63.2% | 61.6% (default) / 64.8% (max) | 59.2% (default) / 64.3% (xhigh) |
| Terminal-Bench 2.0 | 69.3% | 69.4% | 82.7% |
| SWE-Bench-Pro-Hard-AA | 47% | — | — |
| Coding Agent Index | 62 | 66 (max) | 65 (xhigh) |

Composer 2.5 は **Frontier モデルと数ポイント以内** で、**1/10〜1/60 のコスト** という「Pareto フロンティア上の異常値」的存在。

#### Post-training の独自技術

1. **Targeted RL with Textual Feedback**: 軌跡中の特定ターンにヒントを挿入し、teacher-student distillation で局所的な行動改善
2. **Synthetic Data at Scale**: feature deletion 等の real-codebase  grounded 合成タスク。reward hacking 対策も必要に
3. **Sharded Muon + dual mesh HSDP**: 1T MoE モデルの continued pretraining インフラ

これらは **生の Kimi K2.5 には含まれない** Cursor 固有の改善である。

### 「同等モデル」を評価する軸

Composer 2.5 Fast の価値提案を分解すると、以下の5軸で代替候補を評価できる。

| 軸 | Composer 2.5 Fast | 代替選定の意味 |
|----|-------------------|---------------|
| **コーディング精度** | Frontier 級（Index 62） | SWE-bench Verified/Pro、Terminal-Bench |
| **速度・レイテンシ** | Index 3位の速度（6.7分/タスク） | TTFT、tokens/sec、MoE の active params |
| **コスト効率** | $0.44/task (Fast) | input/output 単価、prompt caching |
| **API/ポータビリティ** | Cursor 専用 ❌ | OpenAI 互換 API、OpenRouter、セルフホスト |
| **エージェント適性** | ツール呼び出し、長期ホライズン | function calling、MCP、multi-turn RL |

---

## 詳細な仕組み・理論

### Cursor SDK：Composer 2.5 を Cursor 外から使う唯一の公式経路

2026年4月〜5月に Cursor SDK（TypeScript `@cursor/sdk`、Python `cursor-sdk`）が公開された。これにより **Cursor Agent ランタイム上で Composer 2.5 を programmatic に呼び出せる**。

```typescript
import { Agent } from "@cursor/sdk";

const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2.5-fast" },
  local: { cwd: process.cwd() },
});

const run = await agent.send("Fix the failing tests");
for await (const event of run.events()) {
  console.log(event);
}
```

**制約**:
- Cursor API Key（Dashboard → Integrations）が必要
- Cursor の Agent ハーネス（ツール、MCP、ファイル編集）に依存 — 生の LLM API ではない
- Claude Code / OpenCode / Aider 等の **他エージェントから直接 Composer 2.5 の weights/API を呼ぶことは不可**
- CI/CD、カスタム bot、バックエンドサービスへの組み込み用途では有効だが、「Cursor Agent 以外から使いたい」という要求には **部分的な回答** に留まる

### オープンウェイト MoE コーディングモデルの台頭

2026年前半、中国発のオープンウェイト MoE モデル群が SWE-bench で Opus 4.6/4.7 と同等のスコアを **1/5〜1/50 のコスト** で達成。共通パターン：

$$\text{Performance} \approx f(\text{Base Model}, \text{Agent RL Post-training}, \text{Synthetic SWE Tasks})$$

- **MoE 効率**: 1T total / 3B〜40B active で推論コストを抑制
- **Agent RL**: 20,000 並列環境での multi-turn tool-use 訓練（Qwen3-Coder の例）
- **OpenAI 互換 API**: 既存エージェント基盤への drop-in 統合

---

## 具体例・応用事例

### 推奨構成1: OpenCode + DeepSeek V4 Pro（コスト最優先・API）

**概要**: 2026年時点で最も「Composer 2.5 Standard に近いコスト効率」を API で実現する構成。

| 項目 | 値 |
|------|-----|
| モデル | DeepSeek V4 Pro |
| API | `https://api.deepseek.com/v1`（OpenAI 互換） |
| 価格 | $0.435/M input（cache miss）、$0.87/M output（2026年5月恒久値） |
| SWE-bench Verified | 80.6% |
| SWE-bench Pro | 55.4% |
| Context | 1M tokens |
| エージェント | OpenCode、Claude Code（base URL 差し替え）、OpenHands |

```json
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "build": {
      "mode": "primary",
      "model": "deepseek/deepseek-v4-pro"
    }
  }
}
```

**向いている用途**: マルチファイル refactor、テスト修正、CI 自動修復。**Terminal 重視** の場合は GPT-5.5 へのエスカレーションを検討。

### 推奨構成2: OpenCode + Kimi K2.6（Composer 系譜・長期 Agent）

**概要**: Composer 2.5 と同一 K2 系譜の最新版。Agent Swarm、長期ホライズンに強い。

| 項目 | 値 |
|------|-----|
| モデル | Kimi K2.6 |
| API | `https://api.moonshot.ai/v1` |
| 価格 | 約 $0.60/M input、$3.00/M output（K2.5 比やや高め） |
| SWE-bench Verified | 80.2% |
| SWE-bench Pro | 58.6% |
| Terminal-Bench 2.0 | 66.7% |
| 特徴 | 300 Agent Swarm、262K context |

OpenRouter 経由: `openrouter/moonshot/kimi-k2.6`

**向いている用途**: 1時間超の自律コーディングセッション、polyglot プロジェクト、Cursor Composer に最も近い「系譜」の API 利用。

### 推奨構成3: Kimi Code CLI + Kimi K2.5/K2.6（Claude Code 代替）

**概要**: Moonshot 公式のオープンソース（Apache 2.0）ターミナル Agent。8,700+ GitHub stars。

```bash
uv tool install kimi-cli
kimi  # TUI 起動
/login  # Moonshot OAuth
```

- **IDE 連携**: VS Code、Cursor（ACP）、Zed、JetBrains
- **MCP 対応**: あり
- **プロバイダ**: Kimi API デフォルト、OpenAI/Anthropic/Gemini 等も設定可能（`~/.kimi/config.toml`）
- **Agent Swarm**: K2.5/K2.6 で最大100並列サブエージェント

Composer 2.5 の post-training 差はあるが、**同じ Moonshot モデルを Claude Code 相当の UX で使える** 最も直接的な代替。

### 推奨構成4: マルチモデルルーティング（Oh My OpenAgent パターン）

本番チーム向けの **tiered routing** — Composer 2.5 Fast の「安くて速い default + 必要時エスカレーション」を再現。

| Agent ロール | Primary | Fallback | 理由 |
|-------------|---------|----------|------|
| Orchestrator | Kimi K2.6 | DeepSeek V4 Pro | 長期計画・分解 |
| Implementation | DeepSeek V4 Pro | Kimi K2.6 | コスパ最良の実装 |
| Explore/Search | DeepSeek V4 Flash | — | 最安・高速 |
| Code Review | Kimi K2.6 | DeepSeek V4 Pro | 精度重視 |
| Escalation | Claude Opus 4.7 | GPT-5.5 | 最難関のみ |

実測例（2,415 Agent ターン、$76.77）: Kimi K2.6 が82.2%のターンを処理、DeepSeek V4 Flash が低リスクタスク、Opus はフォールバックのみ。

### 推奨構成5: 超低コスト — Xiaomi MiMo-V2.5 / DeepSeek V4 Flash

2026年5月27日、Xiaomi MiMo-V2.5 シリーズが **最大99%値下げ**（恒久）。

| モデル | Input (cache miss) | Output | SWE-bench Verified |
|--------|-------------------|--------|-------------------|
| MiMo-V2.5 | $0.14/M | $0.28/M | ~78.6% (Thinking mode) |
| MiMo-V2.5-Pro | $0.435/M | $0.87/M | より高精度 |
| DeepSeek V4 Flash | $0.14/M | $0.28/M | 79.0% |

**向いている用途**: 大量の inline completion、ログ解析、ボイラープレート生成、分類。Composer 2.5 Fast の「対話的だが安い」に最も近い単価帯。

### 推奨構成6: セルフホスト — Qwen3-Coder-Next

| 項目 | 値 |
|------|-----|
| パラメータ | 80B MoE / 3B active |
| SWE-bench Verified | 70.6%（SWE-Agent scaffold） |
| 必要 VRAM | 46GB（量子化版、RTX 4090 級） |
| ライセンス | Apache 2.0 |
| 速度 | 93.3 tok/s（ホスト API 測定） |

API コスト $0、データ主権確保。性能は Composer 2.5 より劣るが、**ローカルで Agent 実行** する場合の2026年ベストクラス。

### 推奨構成7: フロンティア API — GPT-5.2-Codex / Claude Sonnet 4.6

Composer 2.5 を **上回る** 精度が必要な場合。

| モデル | Input | Output | 特徴 |
|--------|-------|--------|------|
| GPT-5.2-Codex | $1.75/M | $14/M | 400K ctx、Codex 専用、Agentic coding SOTA 級 |
| Claude Sonnet 4.6 | $3.00/M | $15.00/M | Composer 2.5 Fast と同単価帯、1M ctx |
| Claude Opus 4.7 | $5.00/M | $25.00/M | SWE-bench Pro 64.3%、最高精度 |

OpenCode から `anthropic/claude-sonnet-4-6` 等を指定すれば、**Composer 2.5 Fast と同じ $3/$15 帯** で Sonnet 4.6 が使える。速度は Composer 2.5 Fast より劣る可能性があるが、API ポータビリティは完全。

---

## 重要人物・文献

### 主要プレイヤー

| 組織 | モデル | 役割 |
|------|--------|------|
| **Cursor (Anysphere)** | Composer 2.5 / 2.5 Fast | IDE ネイティブ Agent モデル、K2.5 post-training |
| **Moonshot AI** | Kimi K2.5 / K2.6 | Composer のベースチェックポイント、Kimi Code CLI |
| **DeepSeek** | V4 Pro / V4 Flash | コスト効率王者、OpenAI 互換 API |
| **Alibaba (Qwen)** | Qwen3-Coder-480B / Coder-Next | Agent RL at scale、ローカル実行 |
| **Z.ai** | GLM-5.1 | フロントエンド Agent 特化、MIT ライセンス |
| **MiniMax** | M2.7 | 低コスト長期 Agent、10B active |
| **Xiaomi** | MiMo-V2.5 | 2026年5月の価格破壊、1M context |
| **OpenAI** | GPT-5.2-Codex / GPT-5.5 | Codex CLI、Frontier API |
| **Anthropic** | Claude Opus/Sonnet 4.6/4.7 | Claude Code、最高ベンチマーク |

### 重要なベンチマーク

- **Artificial Analysis Coding Agent Index**: 実 Agent ハーネスでの E2E 評価。Composer 2.5 = 62
- **SWE-bench Verified / Pro / Multilingual**: GitHub issue 解決率
- **Terminal-Bench 2.0**: シェル・DevOps タスク
- **CursorBench v3.1**: Cursor 独自の harder タスクセット
- **LiveCodeBench**: 競技プログラミング

### 公式ドキュメント

- Cursor Composer 2.5 発表: https://cursor.com/blog/composer-2-5
- Cursor SDK: https://cursor.com/docs/sdk/typescript
- Kimi K2.5 GitHub: https://github.com/MoonshotAI/Kimi-K2.5
- Moonshot API: https://platform.moonshot.ai
- DeepSeek API: https://api.deepseek.com
- OpenCode: https://opencode.ai/docs/agents/
- Artificial Analysis: https://artificialanalysis.ai/articles/cursor-composer-2-5-coding-agent-index

---

## 最新動向・未解決問題

### 2026年5月の市場動向

1. **中国系オープンウェイトの価格競争**: DeepSeek V4 Pro 75% OFF 恒久化、MiMo-V2.5 99% 値下げ。Opus 4.7 の「プレミアム税」が構造的に縮小
2. **Cursor × SpaceXAI**: Colossus 2 で from scratch モデル訓練中。Composer 2.5 は K2.5 ベースの「最後のモデル」
3. **DeepSeek Code（Harness チーム）**: Claude Code / Cursor 競合の first-party Agent を開発中（2026年5月時点で hiring 段階）
4. **Cursor SDK 公開**: Composer 2.5 を CI/CD・カスタム bot から呼べるようになったが、依然 Cursor ロックイン
5. **Anthropic distillation 問題**: 2026年4月、MiniMax / DeepSeek / Moonshot が distillation 疑惑で名前される。エンタープライズ調達では考慮必要

### 未解決の課題

| 課題 | 詳細 |
|------|------|
| **Composer 2.5 の API 公開時期** | 非公開。Cursor moat として維持される可能性 |
| **Raw K2.5 vs Composer 2.5 の実 gap** | ベンチマーク差は公開されているが、同一ハーネスでの K2.5 単体比較は少ない |
| **Terminal タスクの弱点** | Composer 2.5 は Terminal-Bench 69.3% vs GPT-5.5 82.7%。シェル/DevOps 中心なら GPT-5.5 優位 |
| **ベンチマーク vs 実運用ギャップ** | SWE-bench 80% でも「smoke test では別の話」という実務報告あり |
| **地政学リスク** | 中国系モデルのエンタープライズ採用、データ residency、API 安定性 |
| **Agent ハーネスの重要性** | 同一モデルでも OpenCode vs Claude Code vs Cursor で結果が異なる。モデル単体比較の限界 |

### 将来予測（2026後半）

- Cursor from-scratch モデル → Composer 3 相当。API 公開は依然不明
- DeepSeek Code 正式リリース → V4 + 専用 Harness で Cursor 対抗
- モデルルーティングの標準化 → 「default cheap + escalation expensive」が全 Agent 基盤のデフォルト
- ローカル MoE（Qwen3-Coder-Next 等）の実用域拡大 → 3B active で 70% SWE-bench

---

## 関連トピック

### エージェントフレームワーク比較

| フレームワーク | モデル | ライセンス | Composer 2.5 代替として |
|--------------|--------|-----------|----------------------|
| **OpenCode** | 75+ providers | MIT | ◎ 最柔軟 |
| **Kimi Code CLI** | Kimi 系 + BYOK | Apache 2.0 | ○ 系譜が近い |
| **Claude Code** | Claude + BYOK | プロプライエタリ | △ DeepSeek API 差し替え可 |
| **Aider** | 任意 LLM | Apache 2.0 | ○ Git ネイティブ |
| **Codex CLI** | GPT-5.5 等 | OpenAI | △ OpenAI ロックイン |
| **Cursor Agent/CLI** | Composer 2.5 等 | プロプライエタリ | — 本モデルの本体 |
| **OpenHands** | 任意 LLM | MIT | ○ 自律 Agent 研究向け |

### コスト比較表（2026年5月、代表的任务: 100K input + 50K output tokens）

| モデル | 推定コスト/タスク | SWE-bench Verified | API |
|--------|-----------------|-------------------|-----|
| MiMo-V2.5 | ~$0.02 | ~78.6% | ○ |
| DeepSeek V4 Flash | ~$0.02 | 79.0% | ○ |
| DeepSeek V4 Pro | ~$0.09 | 80.6% | ○ |
| Kimi K2.5 | ~$0.19 | ~77% | ○ |
| Composer 2.5 Standard | ~$0.18 | 79.8% | Cursor のみ |
| Composer 2.5 Fast | ~$0.53 | 79.8% | Cursor のみ |
| GPT-5.2-Codex | ~$0.88 | SOTA 級 | ○ |
| Claude Sonnet 4.6 | ~$1.05 | ~62-78% | ○ |
| Claude Opus 4.7 | ~$1.75 | 87.6% | ○ |

### 意思決定フローチャート

```
Composer 2.5 Fast と同等の体験が必要
        │
        ├─ Cursor ロックイン OK？
        │     ├─ Yes → Cursor SDK + composer-2.5-fast
        │     └─ No ↓
        │
        ├─ 最低コスト API？
        │     ├─ Yes → DeepSeek V4 Pro / MiMo-V2.5 + OpenCode
        │     └─ No ↓
        │
        ├─ Composer と同系譜？
        │     ├─ Yes → Kimi K2.6 + Kimi Code CLI or OpenCode
        │     └─ No ↓
        │
        ├─ 最高精度必要？
        │     ├─ Yes → Claude Opus 4.7 / GPT-5.5（エスカレーション専用）
        │     └─ No ↓
        │
        └─ セルフホスト？
              ├─ Yes → Qwen3-Coder-Next / GLM-5.1
              └─ No → DeepSeek V4 Pro + OpenCode（デフォルト推奨）
```

---

## まとめ：実践的推奨

**「Composer 2.5 Fast と同じモデルを Cursor 外から使う」ことは2026年5月時点では不可能** である。ただし、同等の **コスト効率 × コーディング精度 × API ポータビリティ** を求めるなら：

### 第一推奨: DeepSeek V4 Pro + OpenCode
- SWE-bench 80.6%、$0.435/$0.87 per M tokens
- OpenAI 互換 API、Claude Code / OpenHands 等にも転用可
- Composer 2.5 Standard より安く、Fast より遥かに安い

### 第二推奨: Kimi K2.6 + Kimi Code CLI または OpenCode
- Composer 2.5 と同一 K2 系譜の最新版
- Agent Swarm、長期自律セッションに強い
- Terminal-Bench 66.7% で Terminal 面も一定水準

### 第三推奨（速度・単価最重視）: MiMo-V2.5 / DeepSeek V4 Flash
- $0.14/$0.28 per M tokens — Composer 2.5 Fast の input 単価の **1/21**
- ルーティングの「scout / explore」層として最適

### Cursor 内に留まる場合の拡張: Cursor SDK
- CI/CD、カスタム bot、Cloud Agent 自動化
- `composer-2.5-fast` / `composer-2.5`（Standard）の使い分け

### エスカレーション層
- 最難関アーキテクチャ判断のみ Claude Opus 4.7 または GPT-5.5
- 全体コストの5〜10%以下に抑える tiered routing が、Composer 2.5 Fast の「普段使い」哲学に最も近い再現

---

## 参考リンク

- https://cursor.com/blog/composer-2-5
- https://cursor.com/docs/sdk/typescript
- https://cursor.com/docs/sdk/python
- https://artificialanalysis.ai/articles/cursor-composer-2-5-coding-agent-index
- https://github.com/MoonshotAI/Kimi-K2.5
- https://github.com/MoonshotAI/kimi-cli
- https://platform.moonshot.ai
- https://platform.kimi.ai/docs/guide/migrating-from-openai-to-kimi
- https://api-docs.deepseek.com
- https://platform.xiaomimimo.com/docs/en-US/price/pay-as-you-go
- https://opencode.ai/docs/agents/
- https://github.com/QwenLM/Qwen3-Coder
- https://openai.com/index/introducing-gpt-5-2-codex/
- https://devtk.ai/en/blog/ai-coding-agent-cost-comparison-2026/
- https://dev.to/devansh365/opencode-go-oh-my-openagent-the-model-routing-config-that-actually-saves-money-3jmj
- https://codersera.com/blog/kimi-k2-6-vs-deepseek-v4/
- https://particula.tech/blog/deepseek-v4-vs-kimi-k2-6-vs-glm-5-1-open-weight-coding
- https://www.datacamp.com/blog/composer-2-5
- https://getaibook.com/blog/cursor-composer-2-is-built-on-kimi-k2-5/
- https://www.atlascloud.ai/blog/guides/kimi-k2-6-vs-glm-5-1-vs-qwen-3-6-plus-vs-minimax-m2-7-coding-2026
- https://awesomeagents.ai/models/qwen3-coder-next/
- https://tylerfolkman.substack.com/p/i-tested-6-ai-models-across-3-providers
