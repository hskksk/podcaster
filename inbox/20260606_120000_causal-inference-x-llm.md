# 因果推論 × LLM：次世代AI推論技術の最前線

## 概要

大規模言語モデル（LLM）が急速に普及するなか、「なぜそうなったのか」「もし違う行動をとっていたら？」という問いに答えられるAIへの期待が高まっている。従来の機械学習は大量データから「相関」を学ぶことに長けているが、相関は必ずしも因果ではない。因果推論（Causal Inference）は、変数間の因果構造を明示的にモデル化し、介入や反事実を扱うための統計・計算理論体系だ。

LLMと因果推論の融合研究は2023〜2025年にかけて爆発的に増加し、2つの大きな方向性が確立しつつある。

1. **LLMを因果推論に使う（LLM for Causality）**：LLMが持つ膨大な知識を活かして因果グラフの構築や効果推定を自動化する
2. **因果推論でLLMを改善する（Causality for LLM）**：因果理論をLLMのバイアス除去・幻覚抑制・解釈可能性向上に応用する

この2つの流れは相互補完的であり、合わさることで「理解し、説明し、介入できるAI」という次世代の知的システムに近づいている。

---

## 背景・歴史

### 相関主義AIの限界

従来のML・深層学習は、スプリアス相関（偽の相関）に引きずられやすい。例えば、「病院に行く人は死亡率が高い」というパターンをデータから学んでも、「だから病院に行かない方がいい」という誤った介入方針が生まれてしまう。

### Pearl の因果階層（Ladder of Causation）

統計学者・コンピュータ科学者のJudea Pearlは、知的システムの推論レベルを3層に分類した。

| 層 | 活動 | 問い | 例 |
|----|------|------|-----|
| 1層：Association（連合） | 見ること | 「XはYと相関するか？」 | 「雨の日は傘の売り上げが上がる」 |
| 2層：Intervention（介入） | 行動すること | 「do(X)したらYはどう変わる？」 | 「広告を出したら売上はどれだけ増えるか」 |
| 3層：Counterfactual（反事実） | 想像すること | 「もしXがXでなかったら？」 | 「もし投薬しなかったら患者は回復していたか」 |

LLMは膨大なテキストから学習しているが、そのトレーニングパラダイムは本質的に「相関ベース（1層）」だ。真の因果推論（2〜3層）ができるかどうかは、2024〜2025年の研究において大きな焦点となっている。

---

## 核となる概念

### 因果グラフ（Directed Acyclic Graph: DAG）

変数をノード、因果関係を有向辺で表現したグラフ。「親→子」の方向が因果の向きを示す。DAGを使うことで、「どの変数を調整すれば交絡を取り除けるか」が視覚的・形式的に決定できる。

```
広告費 → 売上
気温  → 売上
気温  → アイス消費量 → 売上（交絡）
```

### Structural Causal Model（構造的因果モデル：SCM）

各変数を、親変数と外生ノイズの決定論的関数として表現するフレームワーク。

```
X := f_X(U_X)
Y := f_Y(X, U_Y)
```

ここで U_X, U_Y は観測されない外生変数（ノイズ）。SCMはDAGに「メカニズム」を与えるもので、反事実推論を形式的に扱うことができる。

### do-operator と介入

「do(X=x)」は、グラフ上でXに向かう全ての矢印を切断し、Xをxに強制設定する操作。これにより「自然な観測」と「実験的介入」を区別できる。

$$P(Y | do(X=x)) \neq P(Y | X=x)$$

### 反事実推論の3ステップ

SCMを使った反事実推論は以下の手順で行う。

1. **Abduction（後向き推論）**：観測データから外生ノイズ U の分布を推定する
2. **Action（介入）**：反事実的に変更したい変数に対してdo操作を施す
3. **Prediction（予測）**：変更されたSCMで結果変数の値を計算する

---

## 詳細な仕組み・理論

## 方向性1：LLM for Causality（LLMを因果推論に使う）

### 1-1. 因果発見（Causal Discovery）

従来の因果発見アルゴリズム（PC法、LiNGAM、NOTEARS等）は、データの統計的独立性からDAGを推定するが、変数が100を超えると計算量が爆発し、方向の識別が困難になる問題がある。

LLMは変数名や文脈から暗黙の因果方向を推定できる。例えば「年齢→血圧」は「血圧→年齢」より常識的に正しい、という判断をLLMは持っている。

**主要な活用パターン**：
- **直接推論**：LLMにDAGを直接生成させる。変数名と文脈を入力し、因果グラフをJSON等で出力させる
- **事後補正（Posterior Correction）**：統計アルゴリズムが推定した因果グラフをLLMで検証・修正する
- **事前知識提供（Prior Knowledge）**：LLMが生成した因果的制約（「AはBの原因になれない」等）をアルゴリズムに与えて探索空間を絞る

**ALCM（Autonomous LLM-Augmented Causal Discovery Framework）**（2024年5月）はこれを体系化したフレームワーク。

1. PC/LiNGAMなどの統計アルゴリズムで初期グラフを生成
2. Causal Wrapperがグラフをプロンプト形式に変換
3. LLM-driven Refinferが誤った辺を修正・補完

実験では従来のLLM単独手法と統計手法の両方を上回る結果を示した。

**知識グラフを使ったRAG強化**：GraphRAGをLLM因果発見に組み合わせた研究では、F1スコアがLLM単独の0.636から0.745に向上した（2026年の医療論文）。

### 1-2. 因果効果推定（Causal Effect Estimation）

**ATE（Average Treatment Effect：平均介入効果）** や **CATE（Conditional ATE：条件付き平均介入効果）** の推定にLLMを用いる研究が進んでいる。

LLMは数値的な効果量の推定は苦手だが、「どの変数がコントロール変数になるべきか」「バックドアパスは何か」といった因果グラフの構造判断に強みを持つ。

**DoWhy + EconML との連携**（MicrosoftのPyWhy エコシステム）：
- DoWhyが因果グラフの明示的なモデリングとidentification（識別）を担当
- EconMLが機械学習ベースのCATEを推定
- LLMがグラフ構造の妥当性検証や変数選択を支援

### 1-3. 反事実テキスト生成

LLMを使って「もしXが違ったら」というテキストを生成するタスク。

- **Counterfactual Causal Inference in Natural Language with LLMs**（2024年10月）：テキスト中のイベントに対してdo操作を施し、結果がどう変わるかをLLMで生成
- **Gumbel Counterfactual Generation**（2024年11月）：一般化SCMとGumbel-maxトリックを組み合わせ、LLMから意味論的に整合した反事実を生成するフレームワーク

**Sequence-Driven SCMs（SD-SCMs）**：LLMのメカニズムをSCMの構造方程式として定義する新フレームワーク。GPTなど自己回帰モデルはトークンを順に生成する際「前のトークンのみに条件付ける」という性質から、本質的にSCMと互換性がある。

```python
# 概念的なSD-SCMの例
sd_scm = SequenceDrivenSCM(
    structure=causal_dag,
    mechanisms={"Y": gpt_model}  # LLMがメカニズムを定義
)
# 観測分布・介入分布・反事実分布をサンプリング可能
observational = sd_scm.sample_observational()
interventional = sd_scm.sample_interventional(do(X=1))
counterfactual = sd_scm.sample_counterfactual(X=1, given_X=0)
```

### 1-4. 因果テキスト分類・関係抽出

NLPタスクとして「文中の因果関係を検出する」研究も盛んだ。

- **COPA（Choice Of Plausible Alternatives）**：原因と結果を選ぶQAタスク
- **E-CARE**：因果関係の説明文を生成するベンチマーク
- **CORR2CAUSE**：相関の記述から因果を推論するタスク（LLMは人間に比べて大きく劣る）

CausalBench（2024）では、19のLLMを比較した結果、クローズドソースモデルは単純な因果関係では高性能を示したが、50ノード超のネットワークでは従来の統計アルゴリズムに大きく劣ることが示された。

---

## 方向性2：Causality for LLM（因果推論でLLMを改善する）

### 2-1. バイアス除去・幻覚抑制

LLMが持つ**ショートカット学習**（superficial patternへの依存）と**幻覚**（事実と異なる生成）を因果理論で抑制する試みが増えている。

**Causal Prompting：Front-Door Adjustment の応用**（AAAI 2025採択）

Front-Door Adjustmentは、交絡変数へのアクセスなしに因果効果を推定する手法。これをプロンプト設計に応用した手法。

通常のPrompting:
```
[X（プロンプト）] → [Y（出力）]
      ↑               ↑
 [C（交絡：事前知識バイアス）]←←←←←←←↗
```

Front-Door Adjustment Prompting:
```
[X（プロンプト）] → [M（Chain-of-Thought中間変数）] → [Y（出力）]
```

中間変数MとしてCoTを使うことで、交絡（バイアス）をブロックできる。Self-ConsistencyとクラスタリングアルゴリズムでCoTの確率を推定し、正規化加重幾何平均で最適なデモンストレーションセットを選択する。数学的推論・複数ホップQA・自然言語理解タスクで精度と堅牢性が改善した。

**Unbiased Reasoning via Conditional Front-Door Adjustment**（2025年8月）：知識集約タスクでの偏りをFront-Door Adjustmentで除去する発展版手法。

### 2-2. メカニズム的解釈可能性（Mechanistic Interpretability）

LLMの内部をブラックボックスとして扱わず、「どの中間表現が何の情報を担っているか」を因果的に調べるアプローチ。

**Causal Tracing（因果トレーシング）**：

特定の事実（「エッフェル塔はどこにある？」→「パリ」）がLLMのどのレイヤーに格納されているかを特定する技術。

1. クリーン入力で全活性化を記録
2. コラプト入力（事実を変えた）で推論を実行
3. コラプト実行に途中からクリーン活性化を注入（**Activation Patching**）
4. 注入した活性化が出力を復元したら、そのレイヤー・位置が因果的に重要

$$\text{PatID}(k, l) = P_\text{clean}(\text{answer}) - P_\text{corrupted+patch at (k,l)}(\text{answer})$$

**Sparse Autoencoder（SAE）を使った特徴分離**（2024〜2025年の主流）：

多義的な特徴を「スーパーポジション」として格納するLLMの中間層を、SAEで疎な特徴ベクトルに分解。各特徴が「どの概念に対応するか」を解釈可能にする。

アンソロピックの研究（2024年）では、Claude等のモデルの中間層から数百万の解釈可能な特徴（「首相」「DNA」「感情的苦悩」等）を発見したと報告。

**Circuit Discovery（回路発見）**：

「特定のタスクに関与する最小限のニューラル回路（サブグラフ）」を特定する研究。例えば「間接目的語識別（IOI）タスク」はモデルのほんの一部の注意ヘッドで実現されていることが判明。

### 2-3. 因果的手法でLLMの推論を強化

**G²-Reasoner**：一般知識とゴール指向プロンプトを組み合わせ、LLMの因果推論能力を向上させる手法。新規タスクや反事実文脈での推論改善が確認された。

**CausalCoT（因果的Chain-of-Thought）**：通常のCoTを因果グラフ生成 → 推論ステップ実行の2段階に分け、因果構造を中間表現として明示化する手法。

**Post-Training for Causal Reasoning**（2025年2月）：SFT（教師あり微調整）、オフラインRL、オンラインRLなどのpost-trainingでLLMを因果推論専用に特化させる研究。ある研究では、適切なpost-trainingによりLLMの因果推論精度が大幅に改善することを確認した。

---

## 具体例・応用事例

### ヘルスケア・医療

**因果発見 × LLM の医療応用**（2026年2月、medRxiv）：慢性腰痛の因果グラフを、知識グラフとLLMのRAGを組み合わせて自動構築。医師の専門知識なしに、臨床上意味のある因果構造を発見。

**副作用シグナル検出**（LiverTox）：LLMを使った医薬品安全性テキストの因果分析で、薬剤誘発性肝障害のシグナルを早期検出。

**臨床試験設計**：LLMが観察データから反事実を生成し、ランダム化比較試験（RCT）の仮想対照群を構築するシミュレーテッドRCT手法。

### ビジネス・マーケティング

**DeepCausalMMM**（2025年10月）：GRUベースの時系列モデル、DAGベースの構造学習、Hill方程式のレスポンスカーブを組み合わせた深層学習マーケティングミックスモデリング。メディア別の介入効果を推定。

**予算の差異分析**（2026年2月）：Causal-LLMというハイブリッドフレームワークで、企業の予算差異（想定vs実績）の根本原因を自動診断・説明生成。

### ITオペレーション・障害分析

**Causely**（Gartner Cool Vendor 2025受賞）：マイクロサービスの依存関係マップをリアルタイム更新し、因果AIでインシデントの根本原因を自動特定。障害解決時間を80%短縮。

**Dynatrace Davis AI**：トポロジー認識型の因果AIで、数十のダウンストリームサービスに影響が出ている場合でも起点サービスを特定。

### 推薦システム

因果推論は推薦システムのデータバイアス（クリックバイアス・ポジションバイアス）を除去するために使われる。LLMをユーザー意図の解釈に、因果推論をバイアス補正に使う組み合わせが2025年に急増している。

---

## 重要人物・文献

- **Judea Pearl**（UCLA）：因果推論の階層理論、do-calculus、SCMの創始者。チューリング賞（2012）受賞。著書"The Book of Why"（2018）
- **Bernhard Schölkopf**（Max Planck Institute）：因果表現学習、独立因果メカニズム（ICM）の提唱者
- **Yoshua Bengio**（Mila）：深層学習と因果推論の統合を主張し続けている
- **Jonas Peters**（University of Copenhagen）：不変因果予測（ICP）の提唱者

**主要調査論文**：
- "Causal Inference with Large Language Model: A Survey"（arxiv:2409.09822, 2024〜2025）
- "Large Language Models and Causal Inference in Collaboration: A Survey"（arxiv:2403.09606, 2024）
- "Large Language Models for Causal Discovery: Current Landscape and Future Directions"（arxiv:2402.11068, 2024）
- "A Survey on Enhancing Causal Reasoning Ability of Large Language Models"（arxiv:2503.09326, 2025）

**重要フレームワーク・論文**：
- ALCM（arxiv:2405.01744）：LLM強化型自律因果発見フレームワーク
- Causal Prompting（AAAI 2025）：Front-Door AdjustmentによるLLMのバイアス除去
- Gumbel Counterfactual Generation（arxiv:2411.07180）：LLMからの反事実生成
- Language Models as Causal Effect Generators（arxiv:2411.08019）：LLMと因果効果生成の統合

---

## 最新動向・未解決問題

### LLMは本当に因果推論ができるのか？

2025年6月のarXiv論文「Unveiling Causal Reasoning in Large Language Models: Reality or Mirage?」は、この問いに正面から取り組んでいる。結論は「LLMは浅い1層（連合・相関）レベルの因果推論は得意だが、真の2〜3層（介入・反事実）レベルは苦手」というもの。

新ベンチマーク「CausalProbe-2024」では、以前のベンチマークより大幅に低いスコアをLLMが記録。「記憶」と「推論」の混同が主因と見られる。

### 幻覚の問題

因果タスクにおけるLLMの幻覚は特に問題が大きい。通常の事実誤りと異なり「もっともらしい嘘の因果関係」を生成するため、検出が非常に難しい。

### 分布シフトへの脆弱性

相関ベースのLLMは分布シフト（学習データと異なる分布のデータ）に弱い。因果推論ベースのシステムはドメインが変わっても因果メカニズムが安定しているという性質（**独立因果メカニズム原理**）を活用でき、このギャップを埋める研究が進んでいる。

### スケーラビリティの限界

- 大規模グラフ（ノード50以上）での因果発見精度が統計手法に劣る
- 高次元テキストデータでのSCM推定が計算量的に困難
- LLMのコンテキスト長制限が複雑な因果グラフ表現のボトルネックになる

### LLMへの因果的制約の組み込み

現在のLLM学習（次トークン予測）に因果的な目的関数を追加しようとする研究が生まれている。「因果的に正しい予測」を報酬とするRLHFの拡張として、Causal-RLHFの研究が2025年に複数発表された。

---

## 関連トピック

- **Causal Representation Learning（因果表現学習）**：潜在空間で因果構造を学習しようとする深層学習の研究分野。VAEやdiffusion modelと因果推論を組み合わせる
- **Interventional World Models**：将来の介入結果を内部シミュレーションできる世界モデル。強化学習のモデルベース手法との融合
- **Neuro-Symbolic AI**：シンボリックな因果推論エンジンとニューラルネットワークを組み合わせるアプローチ
- **Explainable AI（XAI）**：SHAP値等のXAI出力をLLMが自然言語で説明する手法（因果的説明の自動生成）
- **Fairness & Counterfactual Fairness**：「もし性別や人種が違ったら同じ判断をしたか」という反事実公平性の評価

---

## 参考リンク

- [Causal Inference with Large Language Model: A Survey (arxiv)](https://arxiv.org/abs/2409.09822)
- [Large Language Models and Causal Inference in Collaboration: A Survey (arxiv)](https://arxiv.org/abs/2403.09606)
- [ALCM: Autonomous LLM-Augmented Causal Discovery Framework (arxiv)](https://arxiv.org/abs/2405.01744)
- [Causal Prompting: Debiasing LLM Prompting based on Front-Door Adjustment (arxiv)](https://arxiv.org/pdf/2403.02738)
- [LLM causal reasoning benchmark: CausalBench (arxiv)](https://arxiv.org/abs/2404.06349)
- [Gumbel Counterfactual Generation From Language Models (arxiv)](https://arxiv.org/pdf/2411.07180)
- [Language Models as Causal Effect Generators (arxiv)](https://arxiv.org/abs/2411.08019)
- [A Survey on Enhancing Causal Reasoning Ability of LLMs (arxiv)](https://arxiv.org/html/2503.09326v1)
- [Unveiling Causal Reasoning in LLMs: Reality or Mirage? (arxiv)](https://arxiv.org/abs/2506.21215)
- [PyWhy オープンソースエコシステム](https://www.pywhy.org/)
- [因果推論×LLMで実現する自然言語による説明生成（日本語）](https://research.smeai.org/causal-inference-llm-explanation-generation/)
- [LLMの因果推論能力の限界と最新改善手法（日本語）](https://research.smeai.org/llm-causal-inference-scm-integration/)
- [LLMは因果推論を理解できるのか？（Insight Edge）](https://techblog.insightedge.jp/entry/genai-causal-inference)
