# エージェント型AIによるデータ分析・データサイエンスサービス（2025年以降）

## 概要

2025年以降、データ分析・データサイエンスの領域では「チャットでSQLを書く」段階から、**自律的に仮説を立て・複数ソースを横断・根因分析まで完遂するエージェント**へと製品コンセプトが急速に進化している。Amity Solutionsが2025年8月に公開したホワイトペーパー「Agentic AI for Deep Data Analysis」は、その典型例だ。自然言語クエリ（NLQ）で社内DBとWeb情報を組み合わせ、複数LLMエージェントが分析とアクション推奨を行い、業界のExpert Alignment（専門家知識の注入）でハルシネーションを抑える——という二段階フレームワークを提示している。

本レポートは、同様のコンセプトで開発・提供されている**商用SaaS、クラウドネイティブ機能、国内サービス、オープンソース／開発者向けハーネス**を、2025年以降の公開情報を中心に整理する。単なるBI Copilot（ダッシュボード補助）と、**調査（investigation）・監視（proactive）・行動（action）**まで担うエージェントを意識して分類する。

この分野が面白い理由は、技術（LLM・MCP・セマンティックレイヤ）と組織課題（指標定義の属人化、分析待ち行列）が同時に解かれようとしている点にある。一方で、ベンチマーク上では最良エージェントでも難問の正答率は10〜60%台にとどまり、**「エージェント washing」**（既存機能のラベル付け替え）への警戒も業界では強まっている。

---

## 背景・歴史

### 第1世代：NL-to-SQL／チャットwithデータ（〜2024）

Tableau Ask Data、ThoughtSpot、Looker などが自然言語→クエリ変換を試みたが、多くは**単発質問・単一データソース**に留まった。OpenAI Code Interpreter（Advanced Data Analysis）、Julius AI、PandasAI はファイルアップロード型の対話分析を一般化した。

### 第2世代：データプラットフォーム組み込み（2024〜2025）

Snowflake Cortex Analyst、Databricks AI/BI Genie が、セマンティックモデル／Unity Catalog上の**ガバナンス付きNL-to-SQL**として本格化。Gartnerは「Agentic Analytics」を2026年の市場ガイドとして位置づけ、LangChainの調査では回答・データ分析がエージェント用途の第2位（約24%）と報告されている。

### 第3世代：マルチステップ調査エージェント（2025〜）

- **2025年2月**: Adyen × Hugging Face が **DABstep**（450+の実務型多段タスク）を公開。最良エージェントでも全体の約16%、難問では約14.5%の正答率。
- **2025年7月**: DataRobot が NVIDIA と共同の **Agent Workforce Platform** を発表。
- **2025年8月**: Amity が Deep Data Analysis フレームワークを公開。
- **2025年11月**: Snowflake **Cortex Agents** が GA。
- **2025年秋**: Hex が Threads／Notebook Agent などエージェント群をローンチ。
- **2026年**: Microsoft **Fabric Data Agents** GA、Palantir **AIP Analyst** GA、Tellius 6.x Agent Mode、MinusX が UC Berkeley **DataAgentBench** で首位、Codatum Agent ベータなど。

---

## 核となる概念

### 1. Agentic Data Analysis（エージェント型データ分析）

人間が都度指示するのではなく、エージェントが**計画（plan）→ツール実行（SQL/Python/検索）→検証（reflect）→反復**を行い、説明可能な成果物（レポート、推奨アクション）を出すパラダイム。Amityの枠組みでは次の2段階が典型である。

1. **Data Analysis**: NLQ→SQL、外部Web検索、LLM推論による洞察レポート
2. **Action Recommendation**: 分析結果と業界ガイドラインに基づく実行可能な施策提案

### 2. Expert Alignment / コンテキストレイヤ

LLM単体では「売上」「revenue」「ARR_operational」など企業固有の定義を守れない。**セマンティックレイヤ・メトリクスオントロジ・Expert Playbook**が、正確性の前提になる。GartnerはMCPのみに依存するエージェント分析の60%が2028年までに失敗すると予測しており、**コンテキストの持続的管理**が差別化要因になっている。

### 3. NLQ（Natural Language Query）と決定論的実行の分離

PromptQL のように「LLMは計画のみ、数値処理はプログラム実行」に分離する設計や、CaliberMind Agent Cal の「決定論的SQL」、Altimate の Rust コアによる SQL 検証など、**幻覚を許容しない層**を明示する製品が増えている。

### 4. MCP（Model Context Protocol）

Anthropic発のオープン標準で、エージェントがデータベース・BI・dbtツールを**発見可能なツール**として呼び出す。Hex、MinusX、AgenticBI、Fabric、Delphina（MCPサーバー）などが2025〜2026年に統合を拡大。MCPはエージェントフレームワーク（LangGraph等）を置き換えず、**統合層**として位置づけられる。

### 5. ベンチマークによる客観評価

| ベンチマーク | 焦点 | 2025年以降の示唆 |
|-------------|------|------------------|
| **DABstep** | 金融実務由来の450+多段推論 | 最良でも全体16%前後。コード実行＋文書横断が必須 |
| **DataAgentBench** (UC Berkeley EPIC) | 企業級マルチDB・非構造化混在 | 2026年5月時点でMinusXがPass@1 約63% |
| **InfiAgent-DABench** | CSVベース603問（ICML 2024、更新継続） | オープンエンド質問の自動評価手法 |
| **DA-bench** (dabench.com) | 可視・手動評価型 | 製品比較の補助 |

Amityは今後 DABstep と DA-bench リーダーボードでの検証を明示している。

---

## 詳細な仕組み・理論

### 典型的なアーキテクチャ（多層）

```text
[ユーザー自然言語]
        ↓
[オーケストレーター / Planner LLM]
        ↓
┌───────────────────────────────────────┐
│ ツール群: NL→SQL, Python, Web検索,      │
│ dbt/lineage, 可視化, チケット作成, MCP  │
└───────────────────────────────────────┘
        ↓
[セマンティックレイヤ / カタログ / Playbook]
        ↓
[構造化DB] + [非構造化: 文書・Slack・Web]
        ↓
[検証: LLM-as-Judge, 人間レビュー, 決定論的SQL再実行]
        ↓
[成果物: レポート, ダッシュボード, アクション]
```

### Amityフレームワークの処理フロー（要約）

**Stage 1 データ分析**

1. **Topic classification**: 質問を事前定義トピックに分類
2. **Query generation**: トピック＋補助分析からNLQ・検索キーワードを生成
3. **Data retrieval**: NLQ（SQL）とWeb検索の併用
4. **Data analysis**: 推論モデルが業界プロンプトに沿ってレポート化

**Stage 2 アクション推奨**

1. **Keyword generation**: 分析レポートから事例検索用キーワード抽出
2. **Data retrieval**: ベストプラクティス・事例の取得
3. **Recommendation generation**: 実行可能施策の生成

**Expert Alignment** は両段階で業界専門家のガイドラインを参照し、コンプライアンスと判断品質を担保する。

### 性能評価の例（Amity小売RCA）

人間専門家のELOを基準に、初期エージェント（417〜519）から改善版（2025年4月時点で627超）へと反復評価（LLM-as-Judge＋人間再検証）で向上した、と報告されている。ただしこれは特定ドメイン・評価設計に依存するため、他社ベンチマークへの一般化は慎重に見る必要がある。

### 統計・分析タスクの自動化

Tellius Kaiya Agent Mode などでは、SQLエージェントに加え Python エージェントが **変化点検出、寄与度・分散分解、コホート、予測** を担当し、最後にサマリエージェントがナラティブ化する**マルチエージェントパイプライン**が製品化されている。

---

## 具体例・応用事例

### エンタープライズ向けプラットフォーム

| 製品 | コンセプトの要点 | 2025年以降の動き |
|------|------------------|------------------|
| **Tellius (Kaiya)** | NL-to-SQL＋自律RCA＋24/7 KPI監視。Agent Composerで業務フロー定義 | 6.0 Agent Mode GA。Gartner MQ Visionary（2022–25） |
| **ThoughtSpot Spotter 3** | セマンティックレイヤ上のSearch token、Researchモードで多段調査 | Python実行・予測・MCP（Spotter 3セッションAPI） |
| **Snowflake Cortex Agents** | Cortex Analyst（構造化）＋Cortex Search（非構造化）＋カスタムツール | 2025年11月GA。計画・ツール・reflectループ |
| **Databricks Genie Agent mode** | 仮説検証型: 調査計画→複数SQL→引用付きレポート（旧Research Agent） | 2025–26年パブリックプレビュー／ブログで本格展開 |
| **Microsoft Fabric Data Agents** | OneLake上の会話型エージェント。M365 Copilot・Copilot Studio連携 | Ignite 2025でMCP・Ontology拡張。2026年GA |
| **Palantir AIP Analyst** | Ontology-firstのチャット分析。依存グラフで各ステップ可視化 | 2025年11月ベータ→2026年4月GA報道 |
| **Hex (Threads / Notebook Agent)** | セマンティックモデル grounded の会話分析＋ノートブック深掘り | 2025年秋ローンチ。Slack・MCP対応 |
| **WisdomAI Analytics Agents** | Adaptive Context Engine＋ワークフロー自動化（Slack/API/成果物） | 2026年5月発表。MCPクライアントとして他システム連携 |
| **Delphina** | 自前コンテキストレイヤ＋Criticエージェント。MCPサーバーとして他エージェントに文脈提供 | 競合比較で「精度のPoV」が推奨される |
| **CaliberMind Agent Cal** | GTMデータ上の**決定論的**SQL。監査可能 | 「確率的チャットBI」との差別化 |
| **DataRobot Agent Workforce** | CrewAI/LangGraph/LlamaIndexテンプレ＋ガバナンス・観測 | 2025年7月、NVIDIA共同 |
| **Dataiku Agents** | Visual/Codeエージェント、データセット・MLモデルをツール化 | 2025年4月発表。Trace Explorer等 |

### データエンジニアリング寄り・開発者向け

| 製品 | 役割 |
|------|------|
| **Altimate Code** | 100+決定論的ツール（SQL, lineage, dbt, FinOps）。ADE-Bench・DataAgentBenchで上位 |
| **MinusX** | Agentic BI。Knowledge Base学習、Metabase連携からBI全体へ拡張。DataAgentBench #1（2026年5月） |
| **Recce + Spacedock** | dbt PRのデータ差分検証をMCP化。Spacedockは承認ゲート付きマルチエージェントオーケストレーション |
| **PromptQL (Hasura)** | 計画と実行分離、Wiki型コンテキスト。DAB評価でReAct比+7ppなど |

### 会話型・民主化ツール

| 製品 | 位置づけ |
|------|----------|
| **Julius AI** | スプレッドシート/DB接続のNL分析。Notebooks、Slack、学習サブエージェント（2026年料金体系） |
| **AgenticBI** | 70+コネクタ。オプションで第三者LLM非送信のプライベートAI |
| **QuantumLayers QL-Agent** | 接続・SQL・統計・レポートスケジュールを一文でオーケストレーション |
| **Amplitude AI Agents** | プロダクト分析特化。実験・ダッシュボード操作まで |

### 国内・日本市場（2025年以降）

| サービス | 概要 |
|----------|------|
| **Codatum Agent**（2026年4月ベータ） | テーブル探索〜SQL・チャートまで自律完遂。コード残存でレビュー可能 |
| **ミロゴス TARS**（2025年） | Slack/Teams上のNLデータ探索 |
| **Sprocket データ分析エージェント**（2025年7月） | SproAgent第一弾。DataStudio β |
| **NRI Solution AI「AIエージェント×データ分析」** | 独自APIで集計（LLMに計算させない）、データカタログ連携 |

### 製品深掘り：Amity型に近い5サービス

**Snowflake Cortex Agents（2025年11月GA）**  
計画フェーズでリクエストを分解し、Cortex Analyst（構造化・Semantic View経由のSQL生成）と Cortex Search（非構造化）、ストアドプロシージャ／UDFのカスタムツールを組み合わせる。各ツール実行後に *reflection* で次アクション（明確化・反復・最終回答）を決定。Data-to-ChartでVega-Lite可視化も可能。課金はオーケストレーション・Analystトークン・Searchインデックス・ウェアハウス実行時間に分割される。

**Databricks Genie Agent mode**  
「なぜ」「もし〜なら」型の探索質問向け。調査計画の作成・修正、複数SQL、結果に基づく仮説検証を反復し、引用・可視化・表を含む最終レポートを返す（旧称 Research Agent）。AI/BIダッシュボード上のGenieからはAgent modeがデフォルトになる方向。プレビュー期間中は追加のAgent課金なし（SQLウェアハウスコストのみ）とドキュメントに記載。別製品の **Genie Code** はノートブック・パイプライン向けコードエージェントであり、分析担当者向けAgent modeと役割が分離されている。

**ThoughtSpot Spotter 3**  
セマンティックレイヤ上の「search token」により text-to-SQL の不確実性を低減。Search mode（高速回答）と Research mode（大きな計算予算で多層調査）の二層。構造化・非構造化の横断、Python・予測、Slack/Jira等への**アクション出力**を謳う。MCPサーバー経由で `create_analysis_session` → `send_session_message` → ポーリングでストリーミング更新を受け取り、外部LLMアプリに埋め込める。

**MinusX**  
「Claude Code for data」と位置づけるAgentic BI。Knowledge Base（テーブル定義、メトリクス、社内ルール）と現在ページ・会話履歴の三層コンテキストを読んでから行動。Explore / Questions / Dashboards / MCPで操作し、成果物は常に編集可能な形で残す。DataAgentBench（企業級・マルチDB）で2026年5月時点Pass@1約63%を公表。Metabaseアシスタントから発展し、BI基盤ごとエージェントネイティブに再設計した事例として注目される。

**PromptQL**  
Hasura社のチーム向け「Wiki＋セマンティック層＋エージェント」。LLMは計画に専念し、実行は決定論的ランタイム（primitive: classify, summarize, extract 等）に委譲するため、ベンダーはCRM/数値タスクで100%正確性を主張するブログを公開している（CRMArena-Proの一部カテゴリ）。DAB（Data Agent Benchmark）共同研究では、ReAct基準よりstratified pass@1が約7ポイント向上する一方、特許文書など非構造化抽出が必要なクエリでは両者とも失敗、と報告されている。

### 消費者・チーム向けツールの限界と使い分け

**ChatGPT / Claude（ファイル分析）**  
アップロードCSVやPDFに対しPython/SQLをサンドボックス実行。セットアップゼロだが、永続的なデータ接続・RLS・監査ログ・プロアクティブ監視はない。Telliusの比較記事では「Level 1 Chat-with-Data」に分類される。

**Julius AI**  
データ分析特化のNLインターフェース。2026年時点でPlus/Pro/Business階層、Postgres・Snowflake・BigQueryコネクタ、Notebooks、Slackエージェント、Learning Sub Agent（スキーマ学習）を提供。エンタープライズガバナンスよりも速度とアクセシビリティが強み。

**Hex Threads**  
ビジネスユーザー向け会話UI。裏側はNotebook Agentと同じフレームワークで、承認済みセマンティックモデル上のみ回答する設計。データチームがNotebookで構築した資産がThreadsのコンテキストを豊かにする「好循環」が製品哲学。

---

## 4段階モデル（成熟度の見方）

Tellius等が用いる整理に近いが、本レポートでも採用する。

| レベル | 名称 | 能力 | 代表例 |
|--------|------|------|--------|
| L1 | Chat-with-Data | スナップショットファイルの対話 | ChatGPT, Claude, Julius |
| L2 | NL-to-SQL Agent | ガバナンス付き単発質問 | Genie, Cortex Analyst, Power BI Copilot |
| L3 | Investigative Agent | ユーザー起点の多段RCA・ナラティブ | Tellius Agent Mode, Spotter Research, Genie Agent mode |
| L4 | Agentic Intelligence | 24/7監視→自律調査→配信 | Tellius Feed, （一部）WisdomAI Agents |

Amityのホワイトペーパーは主にL3（分析＋推奨）に相当し、将来のPlaybook・混合データソース・グレーディングフレームワークでL4に近づける構想を示す。

---

## 選定・導入の実務ガイド

1. **主ボトルネックの特定**: 「SQLが書けない」だけならL2で足りる。「なぜKPIが動いたか」の調査待ちが課題ならL3以上。
2. **コンテキスト投資**: どの製品でも、メトリクス定義・例外ルールの入力なしに精度は頭打ち。Codatum/MinusXは学習ループ、NRIはAPI側決定論、Delphina/WisdomはAdaptive Context Engineとそれぞれ手法が異なる。
3. **PoV（Proof of Value）**: Delphina vs WisdomAIの比較記事が指摘する通り、自社ウェアハウスで同じ質問セットを採点するのが最も信頼できる。
4. **セキュリティ**: AgenticBIのオンプレAI、DataRobotのエアギャップ、FabricのPurview連携など、データ出境要件で候補が絞られる。
5. **ベンチマークの読み方**: ヒント有無・試行回数・モデル構成がリーダーボード順位に効く。DataAgentBenchではMinusX提出が複数モデル併用と明記されている。

---

## 重要人物・文献

### 論文・ベンチマーク

- **DABstep**: Egg et al., 2025 — [arXiv:2506.23719](https://arxiv.org/abs/2506.23719), [Hugging Face Leaderboard](https://huggingface.co/spaces/adyen/DABstep)
- **InfiAgent-DABench**: Hu et al., ICML 2024 — [arXiv:2401.05507](https://arxiv.org/abs/2401.05507)
- **DataAgentBench**: UC Berkeley EPIC Lab — [GitHub](https://github.com/ucbepic/DataAgentBench)

### 業界レポート・ブログ

- Amity Solutions, *Agentic AI for Deep Data Analysis* White Paper, 2025-08
- Tellius, *Best AI Data Analysis Agents in 2026*（12プラットフォーム比較）, 2026-03
- Promethium, *Agentic Analytics Complete Guide*
- Gartner Market Guide for Agentic Analytics（2026引用多数）

### オープンソースフレームワーク（エージェント基盤）

LangGraph、CrewAI、Microsoft AutoGen、Semantic Kernel などは**分析専用ではない**が、上記商用製品の実装基盤として頻出する。

---

## 最新動向・未解決問題

### 動向（2026年前半）

1. **Research / Agent mode の標準化**: Databricks Genie、ThoughtSpot Spotter 3、Hex Threads が「単発NLQを超える調査モード」を競合軸にしている。
2. **MCPによる埋め込み**: 分析エージェントを Claude/Cursor/社内ポータルから呼ぶ構成が増加。
3. **ベンチマーク競争**: MinusX、Altimate、PromptQL、Recce(Spacedock) が DataAgentBench / ADE-Bench でスコアを公表。
4. **ガバナンス製品化**: Fabric・DataRobot・Dataiku が CI/CD、監査、Cost Guard をエージェント向けに拡張。
5. **アクションまで**: WisdomAI、Spotter、Amity Stage 2 のように、洞察→Jira/Slack/施策提案へ接続。

### 機能比較マトリクス（2025–2026時点の公称機能）

※ ◎=強み・GA、○=一部/β、△=限定的、×=なし（公開情報ベース。実装はプラン・エンタイトルメント依存）

| 製品 | 多段RCA | プロアクティブ監視 | NL-to-SQL | 非構造化 | 外部Web | MCP | 決定論的検証 | アクション連携 |
|------|---------|-------------------|-----------|----------|---------|-----|-------------|----------------|
| Amity型（WP） | ○ | △ | ◎ | ○ | ◎ | △ | ○ | ◎ |
| Tellius | ◎ | ◎ | ◎ | ○ | △ | △ | ○ | ○ |
| Snowflake Cortex Agents | ○ | △ | ◎ | ◎ | × | ○ | ○ | ○ |
| Databricks Genie Agent | ◎ | △ | ◎ | △ | × | ○ | ○ | △ |
| ThoughtSpot Spotter 3 | ◎ | ○ | ◎ | ◎ | △ | ◎ | ○ | ◎ |
| Fabric Data Agents | △ | △ | ◎ | ○ | × | ◎ | △ | ○ |
| Palantir AIP Analyst | ○ | △ | ○ | ○ | △ | ○ | ◎ | ○ |
| Hex Threads | ○ | △ | ◎ | △ | × | ◎ | ○ | △ |
| WisdomAI Agents | ○ | ◎ | ◎ | ◎ | △ | ○*client | ○ | ◎ |
| Delphina | ◎ | ◎ | ◎ | ○ | △ | ◎*server | ◎ | ○ |
| MinusX | ○ | ◎ | ◎ | △ | × | ◎ | ○ | ○ |
| Altimate Code | △ | × | ◎ | △ | × | ◎ | ◎ | × |
| Julius AI | × | ○ | ○ | △ | × | △ | △ | ○ |
| Codatum Agent | ○ | △ | ◎ | △ | × | △ | ◎ | ○ |
| NRI AIエージェント×分析 | ○ | △ | ○ | ◎ | △ | △ | ◎ | △ |

\* WisdomAIはMCPクライアント、DelphinaはMCPサーバーとして他エージェントに文脈を提供する。

---

## 未解決問題

| 課題 | 説明 |
|------|------|
| **正確性の上限** | DABstep難問でSOTAでも約15%。非構造化テキスト抽出は全エージェントが苦戦（PromptQL論文も言及） |
| **コンテキスト負債** | dbt未整備企業ではセマンティック層が空。MinusXは「dbt無しでも動く」設計で対処 |
| **幻覚と監査** | 確率的NLGと監査要件の両立。決定論的SQL層の併用が主流解 |
| **コスト・レイテンシ** | 多段推論＋大量SQLはウェアハウスコスト増。Genie Agent modeはプレビュー中は追加課金なしと記載 |
| **Agent washing** | 既存Copilotの再ブランド。真の自律監視・RCAを持つかの見極めが必要 |
| **ベンダーロックイン** | GenieはDatabricks、CortexはSnowflake。横断はTellius/PromptQL/Fabric連携などで部分的に解消 |
| **評価の再現性** | ELO・Pass@1はタスク設計に敏感。Amityの小売RCAとDABstep金融タスクは難易度が異なる |
| **責任の所在** | 自律推奨アクションのコンプライアンス。Expert Alignmentは法規制代替にならない |

### 2026年以降の展望

- **API化**: Databricks Genie Agent modeのAPI、Fabric data agent評価SDKなど、ヘッドレス運用が拡大。
- **非構造化の統合**: Genieのドキュメント分析、Spotter 3のマルチソース、Cortex AgentsのSearch統合が標準セットへ。
- **コスト最適化**: 推論モデルの動的スケーリング（Genieが言及）、マルチモデル構成（MinusXのSonnet+mini+Haiku）のベンチマーク最適化。
- **エージェント間連携（A2A）**: MCPの上にエージェント同士が交渉する拡張が仕様議論されている。
- **日本市場**: Codatum・TARS・Sprocket・NRIなど、日本語UIと国内データソース・権限文化に合わせた製品が増え、グローバル製品との併用が現実的。

---

## 関連トピック

- **Agentic BI / Agentic Analytics**: 分析だけでなくダッシュボード生成・アラート・レポート配信まで含む市場カテゴリ
- **Semantic Layer / Metrics Layer**: dbt Metric Layer、Cube、LookML 等との統合
- **Text-to-SQL**: Cortex Analyst、Genie、Power BI Copilot の中核サブシステム
- **LLM-as-Judge**: AmityのELO評価、DataRobot Quality Guard など品質管理手法
- **Human-in-the-Loop**: Spacedockの承認ゲート、Codatumのプロレビュー
- **データ分析の民主化**: TARS、Codatum、Julius など非SQLユーザー向け
- **AI for Data Engineering**（Altimate、Recce）: 分析エージェントと表裏一体の「正しさ」インフラ

### Amity型フレームワークとの比較軸

評価・選定時は次のチェックリストが有効である。

1. **単発質問 vs 多段調査**（Research/Agent modeの有無）
2. **構造化のみ vs 非構造化併用**（Web検索、文書、トランスクリプト）
3. **Expert/セマンティック層**の保守方法（Playbook、Wiki、自動プロファイリング）
4. **成果物**（SQL提示、引用、PPT/Slack、外部システム連携）
5. **客観ベンチマーク**（DABstep / DataAgentBench 等での再現性）
6. **ガバナンス**（RLS、監査ログ、データ残留ポリシー）

---

## 参考リンク

### 参照元・フレームワーク

- [Amity — Agentic AI for Deep Data Analysis (White Paper)](https://www.amity.co/ai-labs/agentic-ai-deep-data-analysis)
- [DABstep Leaderboard](https://huggingface.co/spaces/adyen/DABstep)
- [DataAgentBench (UC Berkeley EPIC)](https://github.com/ucbepic/DataAgentBench)
- [InfiAgent / DA-Agent](https://github.com/InfiAgent/InfiAgent)

### エンタープライズ・クラウド

- [Databricks — Introducing Genie Agent Mode](https://www.databricks.com/blog/introducing-genie-agent-mode)
- [Snowflake — Cortex Agents (GA 2025-11)](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents)
- [Microsoft — Fabric Data Agents](https://learn.microsoft.com/en-us/fabric/data-science/concept-data-agent)
- [ThoughtSpot — Spotter](https://www.thoughtspot.com/product/agents/spotter)
- [Tellius — Best AI Data Analysis Agents in 2026](https://www.tellius.com/resources/blog/best-ai-data-analysis-agents-in-2026-12-platforms-compared-for-nl-to-sql-autonomous-investigation-and-governance)
- [Hex — Fall 2025 Launch: Agents](https://hex.tech/blog/fall-2025-launch/)
- [Palantir — AIP Analyst announcements](https://palantir.com/docs/foundry/announcements/2025-11/)
- [WisdomAI — Analytics Agents](https://www.wisdom.ai/blog/introducing-analytics-agents)
- [Delphina — Documentation](https://docs.delphina.ai/introduction)
- [DataRobot — Agent Workforce Platform](https://www.datarobot.com/newsroom/press/datarobot-announces-agent-workforce-platform-built-with-nvidia/)

### 開発者向け・新興

- [MinusX](https://minusx.ai/)
- [Altimate Code](https://www.altimate.sh/)
- [PromptQL](https://promptql.io/)
- [Recce — MCP / Agents docs](https://docs.reccehq.com/AGENTS/)
- [Julius AI](https://julius.ai/)
- [AgenticBI](https://www.agenticbi.com/)
- [PandasAI](https://docs.pandas-ai.com/v3/agent)

### 国内

- [Codatum Agent](https://codatum.jp/agent)
- [セプテーニ — TARS プレスリリース](https://www.septeni-holdings.co.jp/news/release/2025/10014085.html)
- [Sprocket — データ分析エージェント](https://www.sprocket.bz/release/20250716.html)
- [NRI — AIエージェント×データ分析](https://www.nri.com/jp/service/solution/solution_ai_ai_agent_data_analytics.html)

### プロトコル・ガイド

- [Model Context Protocol Specification](https://modelcontextprotocol.org/specification/2025-11-25)
- [Promethium — Agentic Analytics Guide](https://promethium.ai/guides/agentic-analytics-complete-guide/)

---

*本レポートは2026年6月時点の公開情報に基づく。製品名・機能はベンダーのプレビュー/GA状況により変動する。*
