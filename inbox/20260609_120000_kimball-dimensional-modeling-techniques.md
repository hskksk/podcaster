# キンボール式ディメンショナルモデリング技法 完全ガイド

## 概要

ディメンショナルモデリングは、データウェアハウスおよびビジネスインテリジェンス（DW/BI）システムに向けてデータを整理・提示するための、最も広く普及した手法である。その中核を成すのが「キンボール式（Kimball Methodology）」と呼ばれるアプローチで、1996年にRalph Kimballが著書 *The Data Warehouse Toolkit* の中で体系化した。

キンボール式の基本思想は、「ビジネスユーザーが自然に理解できる形でデータを構造化する」という点にある。複雑に正規化されたデータベースとは異なり、ファクトテーブル（測定値の塊）とディメンションテーブル（文脈情報の塊）という二種類のテーブルによって構成される「スタースキーマ」を主な実装形態とする。

この手法は、データの粒度・整合性・履歴管理・多対多関係の処理など、現実のビジネスで直面するさまざまな課題に対応する数十のテクニックを包含する。本ドキュメントでは、キンボール・グループが公式に定義するすべてのディメンショナルモデリング技法を、引用付きで網羅する。

> "Ralph Kimball introduced the data warehouse/business intelligence industry to dimensional modeling in 1996 with his seminal book, The Data Warehouse Toolkit."
> — [Kimball Group公式サイト](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)

---

## 背景・歴史

### ディメンショナルモデリングの起源

「ディメンション」や「ファクト」という用語自体は、1960年代にGeneral MillsとDartmouth大学が共同で行った研究プロジェクトにまで遡る。さらに1970年代には、AC NielsenやIRIが自社のシンジケートデータ提供においてこれらの概念を実用化した。

Ralph Kimballは1944年7月18日生まれ。スタンフォード大学で電気工学（人間–機械システム専攻）の博士号を取得後、ゼロックスのパロアルト研究所（PARC）でXerox Starワークステーションの主任設計者を務めた。このワークステーションは、マウス・アイコン・ウィンドウを採用した最初の商業製品として知られる。

### 主要著作の変遷

| 年 | 著作 |
|---|---|
| 1996 | *The Data Warehouse Toolkit*（初版） |
| 1998 | *The Data Warehouse Lifecycle Toolkit* |
| 2004 | *The Data Warehouse ETL Toolkit* |
| 2013 | *The Data Warehouse Toolkit, 3rd Edition*（Ralph Kimball & Margy Ross共著） |
| 2015 | *The Kimball Group Reader* |

2013年の第3版では、SCD（緩やかに変化するディメンション）の Type 0, 4, 5, 6, 7 などの高度なテクニックが正式に体系化された。本ドキュメントで参照する技法一覧は、主にこの第3版に基づいている。

> "These techniques are drawn from The Data Warehouse Toolkit, Third Edition (coauthored by Ralph Kimball and Margy Ross, 2013) and represent the official Kimball approach to dimensional modeling."
> — [Kimball Group公式サイト](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)

### Inmon流との対比

データウェアハウスの設計アプローチとして有名なのがKimball流（ボトムアップ、ディメンショナルモデリング）とInmon流（トップダウン、正規化設計）の二流派である。KimballはビジネスユーザーにとってのわかりやすさとBI性能を優先するのに対し、InmonはエンタープライズDWの統合性を優先する。現代の多くの組織はこれらを組み合わせたハイブリッド手法を採用している。

---

## 核となる概念

### 1. ビジネス要件とデータの現実性の把握（Gather Business Requirements and Data Realities）

ディメンショナルモデリングを開始する前に、チームはビジネスの要件と、ソースデータの実態の両方を把握しなければならない。

**ビジネス要件の収集：**
- 業績指標（KPI）の把握
- 重要なビジネス課題の分析
- 意思決定プロセスと分析ニーズの理解

**データの現実性の把握：**
- ソースシステムの専門家との協議
- 高レベルのデータプロファイリング
- データ実現可能性の評価

> "Requirements are uncovered via sessions with business representatives to understand their objectives based on key performance indicators, compelling business issues, decision-making processes, and supporting analytic needs."
> — [Kimball Group, Gather Business Requirements and Data Realities](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/business-requirements-data-realities/)

### 2. 協調的ディメンショナルモデリング・ワークショップ（Collaborative Dimensional Modeling Workshops）

ディメンショナルモデルは、ビジネスのサブジェクトマター専門家やデータガバナンス担当者との共同作業で設計されなければならない。

> "The data modeler is in charge, but the model should unfold via a series of highly interactive workshops with business representatives. Dimensional models should not be designed in isolation by folks who don't fully understand the business and their needs; collaboration is critical!"
> — [Kimball Group, Collaborative Dimensional Modeling Workshops](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/collaborative-modeling-workshop/)

### 3. 4ステップ設計プロセス（Four-Step Dimensional Design Process）

Kimballのディメンショナル設計プロセスは、以下の4ステップから成る。

**ステップ1：ビジネスプロセスの選択**
注文処理、保険請求処理、学生登録、月次口座スナップショットなど、分析対象のビジネスプロセスを特定する。多くのファクトテーブルは単一のビジネスプロセスに焦点を当てる。

**ステップ2：粒度（Grain）の宣言**
ファクトテーブルの1行が何を表すかを正確に定義する。可能な限り最も原子的なレベル（それ以上分割できないレベル）で設定することが推奨される。

**ステップ3：ディメンションの識別**
「このビジネスプロセスの測定イベントをビジネスユーザーはどのように説明するか？」という問いに答える形で、「誰が、何を、どこで、いつ、なぜ、どのように」を表す属性群を抽出する。

**ステップ4：ファクトの識別**
「このプロセスは何を測定しているか？」という問いに答える形で、数量や金額などの数値的な測定値を決定する。

> "The answers to these questions are determined by considering the needs of the business along with the realities of the underlying source data during the collaborative modeling sessions."
> — [Kimball Group, Four-Step Design Process](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/four-4-step-design-process/)

### 4. 粒度（Grain）

粒度（グレイン）は、ディメンショナルモデリングにおける最重要概念のひとつである。

> "Atomic grain refers to the lowest level at which data is captured by a given business process."
> — [Kimball Group, Grain](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/grain/)

粒度の宣言は「設計上の拘束力ある契約」となる。全てのディメンションとファクトの候補は、宣言された粒度と整合していなければならない。同一のファクトテーブルに異なる粒度を混在させてはならない。

キンボール・グループは、予測不可能なユーザー要求に対応できるよう、まず原子粒度に焦点を当てることを強く推奨している。

### 5. スタースキーマとOLAPキューブ（Star Schema and OLAP Cube）

ディメンショナルモデルの実装形態には二種類ある。

**スタースキーマ（Star Schema）：**
リレーショナルデータベースでの実装形式。ファクトテーブルが主キー/外部キー関係を通じて周囲のディメンションテーブルにリンクされた構造。スター（星）のような形状から命名。

**OLAPキューブ：**
多次元データベースでの実装形式。SQLよりも高度な分析機能を持つXMLAなどの言語でアクセスされる。リレーショナルスタースキーマと同等の内容を持つか、より原子的なスキーマから派生することが多い。

> "A star schema implemented in a relational database management system has fact tables linked to associated dimension tables via primary/foreign key relationships."
> — [Kimball Group, Star Schema / OLAP Cube](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/star-schema-olap-cube/)

### 6. ディメンショナルモデルの優雅な拡張性（Graceful Extensions）

ディメンショナルモデルは、予期しない新しいデータ要素や設計変更に対して「優雅に」対応できる。以下の変更はいずれも、既存のBIクエリやアプリケーションを変更したり、クエリ結果を変えたりすることなく実装できる。

- 新しいディメンションをファクトテーブルに追加（粒度を変えない新しい外部キー列の追加）
- 既存のファクトテーブルに新しいファクト列を追加
- 既存のディメンションテーブルに新しい属性列を追加
- テーブルへの新しいデータ行の追加

> "The dimensional model is gracefully extensible to accommodate unexpected new data elements and new design decisions. All the following changes can be implemented without altering any existing BI query or application."
> — [Kimball Group, Graceful Extensions](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/extensions/)

---

## ファクトテーブル技法（Fact Table Techniques）

### 基本構造

ファクトテーブルは実世界の測定イベントから生成された数値メトリクスを保持する。

> "A fact table contains the numeric measures produced by an operational measurement event."
> — [Kimball Group, Fact Table Structure](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/fact-table-structure/)

典型的なファクトテーブルの行は以下の要素で構成される：
1. 関連する各ディメンションへの外部キー
2. 実際の測定値（数値ファクト）
3. 退化ディメンションキー（オプション）
4. 日時タイムスタンプ（オプション）

ファクトテーブルの基本設計は物理的な活動に基づいており、後の報告要件によって影響を受けない。

### 加算的・半加算的・非加算的ファクト（Additive, Semi-Additive, Non-Additive Facts）

> "The most useful facts are numeric and additive. Semi-additive facts can be summed across some dimensions, but not all. Non-additive facts cannot be summed across any dimension."
> — [Kimball Group, Additive, Semi-Additive, Non-Additive Facts](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/additive-semi-additive-non-additive-fact/)

| 種別 | 説明 | 例 |
|---|---|---|
| 加算的（Additive） | 全ディメンションで合計可能 | 売上金額、数量 |
| 半加算的（Semi-Additive） | 一部ディメンションで合計可能 | 残高（時間軸では加算不可） |
| 非加算的（Non-Additive） | 直接合計できない | 比率、パーセンテージ |

非加算的ファクトへの推奨対応策は、完全に加算的な構成要素を保存し、BI層やOLAPキューブで最終計算を行うことである。

### ファクトテーブルのNULL値（Nulls in Fact Tables）

ファクト列のNULL値は許容されるが、外部キーにはNULLを使用してはならない。参照先のディメンションが存在しない場合は、「不明（Unknown）」などのデフォルト行をディメンションテーブルに用意し、ファクトテーブルはそのキーを参照する。

### コンフォームドファクト（Conformed Facts）

同一のファクト定義・単位・粒度で複数のファクトテーブルに登場するファクト。コンフォームドファクトはドリルアクロス分析を可能にする。

### 1. トランザクションファクトテーブル（Transaction Fact Table）

個々のビジネストランザクション（注文明細、POS購入、電話コール等）を1行として記録する最も基本的な形式。

> "Atomic transaction grain fact tables are the most dimensional and expressive fact tables."
> — [Kimball Group, Transaction Fact Table](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/transaction-fact-table/)

- **粒度**：1行 = 1測定イベント
- **特徴**：測定が実際に発生した場合のみ行が存在（疎なテーブルになり得る）
- **利点**：ユーザーが最大限のスライス＆ダイス分析を行える

### 2. 定期スナップショットファクトテーブル（Periodic Snapshot Fact Table）

特定の期間（日、週、月等）の累計状態を1行として記録する形式。

> "The grain is the period, not the individual transaction."
> — [Kimball Group, Periodic Snapshot Fact Table](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/periodic-snapshot-fact-table/)

- **粒度**：1行 = 特定期間の状態
- **特徴**：期間中に活動がなくても行が挿入され、値は0またはNULL
- **用途**：時系列分析、定期的な業績測定

### 3. 累積スナップショットファクトテーブル（Accumulating Snapshot Fact Table）

パイプライン型のプロセス（注文→出荷→配送→請求のような連続ステップ）を、1行で追跡する形式。

> "Accumulating snapshot fact tables have a row for each occurrence of a process that has a definable beginning and end. The row is revisited and updated as pipeline progress occurs."
> — [Kimball Group, Accumulating Snapshot Fact Table](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/accumulating-snapshot-fact-table/)

- **粒度**：1行 = 1プロセスインスタンス（例：1注文）
- **特徴**：各マイルストーンに対応する複数の日付外部キーを持つ；行は進捗に伴って更新される
- **用途**：注文履行、保険請求処理などのワークフロー管理

### 4. ファクトレスファクトテーブル（Factless Fact Table）

数値的な測定値を持たず、複数のディメンション要素が特定時点に集まったイベント自体を記録する。

> "Factless fact tables can also be used to analyze what didn't happen. These queries always have two parts: a fact table that represents events that could happen and another that represents events that did happen."
> — [Kimball Group, Factless Fact Table](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/factless-fact-table/)

**2種類の用途：**
1. **イベントの記録**：学生の授業出席（日付・学生・教師・場所・クラスの外部キーのみ）
2. **未発生イベントの分析**：カバレッジテーブル（発生し得たイベント）からアクティビティテーブル（実際に発生したイベント）を差し引く

### 5. 集計ファクトテーブル（Aggregated Fact Tables / OLAP Cubes）

パフォーマンス最適化のために、原子粒度ファクトテーブルのデータを集計して作成されたファクトテーブル。縮小ロールアップディメンション（後述）と組み合わせて使用する。

### 6. 統合ファクトテーブル（Consolidated Fact Tables）

複数のビジネスプロセスのデータを、分析の便宜上一箇所に統合したファクトテーブル。個別のプロセスが持つ原子的ファクトテーブルを補完する用途で利用される。

---

## ディメンションテーブル技法（Dimension Table Techniques）

### 基本構造

> "Dimension tables contain the descriptive attributes used by BI applications for filtering and grouping the facts stored in fact tables. Dimension tables tend to be wide, flat, denormalized tables with many low-cardinality text attributes."
> — [Kimball Group, Dimension Table Structure](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/dimension-table-structure/)

ディメンションテーブルは単一の主キー列を持ち、この主キーはファクトテーブルの外部キーとして参照される。テキスト属性が豊富に格納されており、クエリの制約条件・集計指定の主要ターゲットとなる。

### サロゲートキー（Surrogate Keys / Dimension Surrogate Keys）

> "All joins between fact and dimension tables in the data warehouse should be based on meaningless integer surrogate keys."
> — [Kimball Group, Surrogate Keys](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/surrogate-key/)

サロゲートキーは業務システムのナチュラルキーに代わる人工的な整数キーである。採用理由は以下の通り：

1. **本番システムからの独立**：ナチュラルキーの再利用・削除・形式変更への保護
2. **SCD対応**：属性変更時の新レコード発行を可能にする
3. **不確実性の処理**：匿名顧客や未知の日付の表現
4. **ストレージ効率**：4バイト整数で20億以上の値を表現可能

適切なサロゲートキーの特性：
- シンプルな連番整数
- 「スマートでない」（キーから情報を推測できない）
- ナチュラルキーの組み合わせではない

### 自然キー・耐久性キー・超自然キー（Natural, Durable and Supernatural Keys）

- **自然キー（Natural Key）**：ソースシステムのキー
- **耐久性キー（Durable Key）**：時間が経過しても変わらない永続的な識別子
- **超自然キー（Supernatural Key）**：外部システムのロジックに依存しない永続的なサロゲートキー

### ドリルダウン（Drilling Down）

ディメンション属性の階層を辿り、より詳細な粒度でデータを分析すること。例：年→四半期→月→日のように時間階層を下位に辿る操作。

### 退化ディメンション（Degenerate Dimensions）

> "A degenerate dimension has no associated dimension table. The key is retained in the fact table without an associated dimension table."
> — [Kimball Group, Degenerate Dimensions](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/degenerate-dimension/)

外部キー以外に保持すべき属性がないディメンション。請求書番号や注文番号がその典型例。ファクトテーブルに直接格納され、対応するディメンションテーブルは存在しない。主にトランザクション型・累積スナップショット型ファクトテーブルで見られる。

### 非正規化フラットディメンション（Denormalized Flattened Dimensions）

多対一階層関係（例：製品→製品カテゴリ→製品部門）はディメンションテーブル内で非正規化してフラット化する。これはキンボール式の基本原則のひとつであり、正規化（スノーフレーク化）よりも一般的に推奨される。

### ディメンション内の複数階層（Multiple Hierarchies in Dimensions）

多くのディメンションは複数の自然な階層を持つ。例えばカレンダー日付ディメンションは日→週→月→四半期→年という複数の独立した階層を持つ。これらはすべて同一のディメンションテーブルに格納できる。

### フラグと指標（Flags and Indicators as Dimension Attributes）

「Yes/No」や真偽値のフラグはわかりやすい英語表記の属性値に変換してディメンションに格納すること（例：「Yes」→「Current Employee」）。

### カレンダー日付ディメンション（Calendar Date Dimension）

ほぼすべてのファクトテーブルが参照する特別なディメンション。

> "The calendar date dimension gives users the ability to navigate along familiar dates, months, fiscal periods, and special days."
> — [Kimball Group, Calendar Date Dimension](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/calendar-date-dimension/)

主な属性：週番号、月名、会計期間、国民祝日フラグ、曜日名、四半期、閏年フラグなど。

主キーには通常の連番サロゲートキーではなく、`YYYYMMDD`形式のインテリジェントキーを使用することもできる。時刻精度が必要な場合は、ファクトテーブルに別途タイムスタンプを追加し、必要に応じて専用の時間ディメンションを用意する。

### ロールプレイングディメンション（Role-Playing Dimensions）

> "A single physical dimension that is referenced multiple times in a fact table. Each reference links to a logically distinct role."
> — [Kimball Group, Role-Playing Dimensions](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/role-playing-dimension/)

例：注文ファクトテーブルが「注文日」「発送日」「配達日」の3つの日付を持つ場合、いずれも同一の日付ディメンションテーブルを参照する。各外部キーはユニークな属性列名を持つビューとして表現される。

### ジャンクディメンション（Junk Dimensions）

> "A junk dimension is a convenient grouping of typically low-cardinality flags and indicators. By creating a single junk dimension, you remove these flags from the fact table and collect them into a useful dimension."
> — [Kimball Group, Junk Dimensions](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/junk-dimension/)

複数の低カーディナリティなフラグや指標を一つのディメンションにまとめる手法。スター型スキーマをシンプルに保ちながら多数の小さなフラグを効率的に管理できる。

実装上の重要点：ジャンクディメンションはすべての属性値の直積（カルテシアン積）を含む必要はなく、ソースデータに実際に現れる組み合わせのみを含める。スキーマ内では「トランザクションプロファイルディメンション」とも呼ばれる。

### スノーフレークディメンション（Snowflaked Dimensions）

ディメンション階層を複数のテーブルに正規化した設計。例えば製品ディメンションを製品テーブル・カテゴリテーブル・部門テーブルに分割する。

キンボール式ではスノーフレーク化は一般的に**推奨されない**。理由は、クエリが複雑になり、BI開発者・エンドユーザーにとって理解しにくくなるからである。ただし特定の条件下では許容される。

### アウトリガーディメンション（Outrigger Dimensions）

> "A dimension can contain a reference to another dimension table. These secondary dimension references are called outrigger dimensions."
> — [Kimball Group, Outrigger Dimensions](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/outrigger-dimension/)

ディメンションが別のディメンションを参照する構造。例：銀行口座ディメンションが口座開設日を表す別の日付ディメンションを参照する。許容されるが多用は避けるべきとされる。

---

## コンフォームドディメンションによる統合（Integration via Conformed Dimensions）

### コンフォームドディメンション（Conformed Dimensions）

> "Conformed dimensions deliver consistent descriptive attributes across dimensional models. They support the ability to drill across and integrate data from multiple business processes."
> — [Kimball Group, Conformed Dimensions](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/conformed-dimensions/)

複数のファクトテーブルで共通して使用できるディメンション。同一の列名とドメインの内容を持つことが条件。コンフォームドディメンションを再利用することで、設計・開発の重複を排除し、市場投入までの時間を短縮できる。

### 縮小ロールアップディメンション（Shrunken Rollup Dimensions）

> "Shrunken rollup dimensions are required when constructing aggregate fact tables. They are conformed dimensions that are a subset of rows and/or columns of a base dimension."
> — [Kimball Group, Shrunken Rollup Dimensions](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/shrunken-rollup-dimension/)

基本ディメンションの行または列のサブセットで構成されるコンフォームドディメンション。集計ファクトテーブル構築時に必要となる。例：日次・商品レベルの販売データを月次・ブランドレベルに集計する場合。

### ドリルアクロス（Drilling Across）

> "Drilling across simply means making separate queries against two or more fact tables where the row headers of each query consist of identical conformed attributes."
> — [Kimball Group Techniques](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)

2つ以上のファクトテーブルに対して、同一のコンフォームドディメンション属性を行見出しとして別々にクエリを実行し、結果を統合すること。これにより複数のビジネスプロセスにまたがる統合レポートが実現する。

### バリューチェーン（Value Chain）

> "A value chain identifies the natural flow of an organization's primary business processes."
> — [Kimball Group, Value Chain](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/value-chain/)

組織の主要ビジネスプロセスの自然な流れを識別する概念。例：小売業では「購買→在庫管理→小売販売」、会計システムでは「予算策定→支出承認→支払い」というフロー。各ステップは通常少なくとも一つの原子的ファクトテーブルを生成する。

### エンタープライズDWバスアーキテクチャ（Enterprise Data Warehouse Bus Architecture）

> "The enterprise data warehouse bus architecture provides an incremental approach to building the enterprise DW/BI system by decomposing the DW/BI planning process into manageable pieces while delivering integration via standardized conformed dimensions."
> — [Kimball Group, Enterprise DW Bus Architecture](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/enterprise-data-warehouse-bus-architecture/)

**特徴：**
- テクノロジー・データベースプラットフォームに依存しない
- リレーショナルデータベースとOLAPの両方の次元構造に対応
- ビジネスプロセスへの集中によって段階的な実装を促進

### エンタープライズDWバスマトリクス（Enterprise Data Warehouse Bus Matrix）

> "The enterprise data warehouse bus matrix is the essential tool for designing and communicating the enterprise data warehouse bus architecture, with rows representing business processes and columns representing dimensions."
> — [Kimball Group, Enterprise DW Bus Matrix](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/enterprise-data-warehouse-bus-matrix/)

行にビジネスプロセス、列にディメンションを配置した表形式のツール。陰影を付けたセルはディメンションとビジネスプロセスの関連を示す。

**用途：**
1. 設計検証：各ディメンションがビジネスプロセスに適切に定義されているか確認
2. ディメンションの標準化：複数プロセスにまたがるディメンションの統一箇所を特定
3. 優先順位付け：経営層とのプロジェクト優先順位決定

### 機会/ステークホルダー・マトリクス（Opportunity/Stakeholder Matrix）

バスマトリクスの拡張形。行にビジネスプロセス、列にビジネスユーザーグループを配置し、各グループが関心を持つビジネスプロセスを示す。プロジェクトのスポンサーシップとデプロイ優先順位の決定に活用される。

---

## 緩やかに変化するディメンション技法（Slowly Changing Dimensions: SCD）

ディメンション属性の値は時間とともに変化することがある。SCDはその変化をどのように処理するかを定める技法群である。

> "The notion of time pervades every corner of the data warehouse."
> — [Kimball Group, Slowly Changing Dimensions](https://www.kimballgroup.com/2008/08/slowly-changing-dimensions/)

### Type 0：元の値の保持（Retain Original）

属性値が変わらない場合、または変更を無視したい場合に適用。顧客の初期クレジットスコアや永続的な識別子などに使用。ファクトは常に元の値でグループ化される。

### Type 1：上書き（Overwrite）

変化した属性値を上書きし、履歴を残さない。エラー訂正や、履歴追跡が不要な変更に適用。実装が最もシンプル。

### Type 2：新行の追加（Add a New Row）

> "Type 2 is the most common SCD technique. A new row is added to the dimension table when an attribute value changes, preserving the old and new values."
> — [Kimball Group, SCD Types](https://www.kimballgroup.com/2008/09/slowly-changing-dimensions-part-2/)

属性が変化すると、新しいサロゲートキーを持つ新しいディメンション行を追加する。元の行は有効期間を設定して保持される。歴史的な属性値と関連するファクトを完全に保存できる。

**実装時の追加フィールド：**
- Row Effective Date（行発効日）
- Row Expiration Date（行失効日）
- Current Row Indicator（現在行フラグ）

### Type 3：新列の追加（Add a New Column）

別の列として「前の値」と「現在の値」を同一行に格納する。変更の履歴を限定的に追跡したい場合（通常は直近の1変更のみ）に使用。制限された代替現実の共存を実現する。

### Type 4：ミニディメンションの追加（Add Mini-Dimension）

> "The type 4 technique is used when a group of dimension attributes are split off into a separate mini-dimension, which is useful when dimension attribute values are relatively volatile."
> — [Kimball Group, Design Tip #152](https://www.kimballgroup.com/2013/02/design-tip-152-slowly-changing-dimension-types-0-4-5-6-7/)

変動性の高い属性グループを別の小さなディメンション（ミニディメンション）に分離する手法。顧客の年収・年齢層・購入頻度などの頻繁に変化する属性に有効。ファクトテーブルは元のディメンションとミニディメンションの両方に外部キーを持つ。

### Type 5：ミニディメンション＋Type 1アウトリガー（Add Mini-Dimension and Type 1 Outrigger）

Type 4のミニディメンションを基に構築し、さらに基本ディメンション内に現在のミニディメンションへの参照（Type 1で上書き）を埋め込む。ファクトテーブルを経由せずに現在のプロファイル属性にアクセス可能になる。

### Type 6：Type 2ディメンションへのType 1属性の追加（Add Type 1 Attributes to Type 2 Dimension）

Type 2で管理される各行に、現在の属性値をType 1として上書きされるカラムを追加する。これにより、測定時点の値と現在の値の両方でフィルタリング・分析が可能になる。

### Type 7：デュアル Type 1 と Type 2（Dual Type 1 and Type 2 Dimensions）

ファクトテーブルがType 2のサロゲートキーと現在のディメンションへのキーの両方を持つ。Type 6と同じ機能を提供するが、実装アプローチが異なる。BI層が適切なキーを選択することで、履歴分析と現在値分析の両方を支援する。

> "Types 0, 4, 5, 6, and 7 were formally documented in Design Tip #152."
> — [Kimball Group, Design Tip #152](https://www.kimballgroup.com/2013/02/design-tip-152-slowly-changing-dimension-types-0-4-5-6-7/)

---

## 階層テクニック（Dimension Hierarchy Techniques）

### 固定深さの位置的階層（Fixed Depth Positional Hierarchies）

固定した数のレベルを持つ多対一階層。例：日→月→四半期→年、製品→ブランド→カテゴリ→部門。

すべての階層レベルをディメンションテーブルの別々の属性として格納（非正規化）することで、クエリパフォーマンスと使いやすさが大幅に向上する。

### やや不規則な可変深さ階層（Slightly Ragged / Variable Depth Hierarchies）

固定した深さを持たないが、深さの範囲が小さい階層。例：地理的階層（市→都道府県→国）はレベル数が国によって異なる場合がある。

> "You can force-fit slightly ragged hierarchies into a fixed depth positional design with separate dimension attributes for the maximum number of levels."
> — [Kimball Group, Slightly Ragged Hierarchies](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/slightly-ragged-variable-depth-hierarchy/)

空のレベルには親レベルの値を繰り返し格納することで、最大深さに合わせたフラット設計に強制適合させる。

### 不規則な可変深さ階層（Ragged / Variable Depth Hierarchies）

> "All objections to SQL extensions can be overcome by modeling a ragged hierarchy with a specially constructed bridge table, which contains a row for every possible path in the ragged hierarchy and enables all forms of hierarchy traversal with standard SQL."
> — [Kimball Group, Ragged Variable Depth Hierarchies](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/ragged-variable-depth-hierarchy/)

組織図や製品分類のように、深さが不定の階層。対応方法は二つ：

1. **階層ブリッジテーブル**：階層内のすべてのパスを表す行を持つ特殊なブリッジテーブルを構築
2. **パス文字列属性（Pathstring Attribute）**：ディメンション行にルートからその行までのパスを文字列として格納（例：`\North America\US\California\San Francisco`）

---

## 高度なファクトテーブル技法（Advanced Fact Table Techniques）

### ファクトテーブルのサロゲートキー（Fact Table Surrogate Keys）

ファクトテーブルにも独自のサロゲートキー（連番の単一列）を設けることで、ETLの更新・エラー処理・パーティション管理が容易になる。

### センチピードファクトテーブル（Centipede Fact Tables）

> "Some designers create separate normalized dimensions for each level of a hierarchy and then include all the foreign keys in a fact table, resulting in a centipede fact table with dozens of dimensions. Centipede fact tables should be avoided."
> — [Kimball Group, Centipede Fact Table](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/centipede-fact-table/)

多対一階層の各レベルを別々のディメンションにして大量の外部キーを持たせたファクトテーブル（百足のような形になることから命名）。この設計は**避けるべき**アンチパターンである。解決策はすべての階層レベルを最下位粒度のディメンション（例：日付ディメンション）に折り畳むこと。

### 数値としての事実と数値としてのディメンション属性（Numeric Values as Facts vs. Dimension Attributes）

数値が測定のためのものならファクト、フィルタリング・グループ化のためならディメンション属性として格納する。

### ラグ/期間ファクト（Lag/Duration Facts）

累積スナップショットファクトテーブルにおける、マイルストーン間の経過時間を表すファクト。

### 遅延到着ファクト（Late Arriving Facts）

> "A fact row is late arriving if the dimensional context for new fact rows doesn't match the incoming row."
> — [Kimball Group, Late Arriving Facts](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)

ファクトデータが遅れて到着した場合、その時点で適切なディメンションコンテキストを特定し、関連するファクト行を修正する必要がある。Type 2 SCD属性への遡及的な変更を伴う場合は、新しいディメンション行を挿入し、関連するファクト行を修正する。

---

## 高度なディメンションテーブル技法（Advanced Dimension Table Techniques）

### 大きなディメンションへの対応（Large Dimensions）

数百万行を超える大規模ディメンション（例：顧客ディメンション）への対応。テーブルのパーティション分割やインデックス設計の最適化が必要になる。

### ミニディメンション（Mini-Dimensions）

> "Rapidly changing monster dimensions can be handled with a mini-dimension. Take the frequently analyzed attributes out of the base dimension and form a separate mini-dimension."
> — [Kimball Group, Design Tip #127](https://www.kimballgroup.com/2010/09/design-tip-127-creating-and-managing-mini-dimensions/)

大規模なディメンションから頻繁に変化する属性グループを分離した小さなディメンション。元のディメンションの変更追跡負荷を削減する。

### 多値ディメンションとブリッジテーブル（Multivalued Dimensions and Bridge Tables）

> "When dimensions take on multiple values for a single measurement event, it's unreasonable to resolve the many-valued dimensions directly in the fact table. A many-to-many dual-keyed bridge table is used."
> — [Kimball Group, Multivalued Dimensions and Bridge Tables](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/multivalued-dimension-bridge-table/)

患者の複数診断名、顧客の複数趣味分類など、1つのファクトに対して複数のディメンション値が存在するケース。対応策：

1. ファクトテーブルの粒度を変更して多値関係を解消
2. グループディメンションキーを通じてブリッジテーブルに接続

ブリッジテーブルには各グループ内の各値に対して1行が含まれる。Type 2 SCD対応が必要な場合は、有効開始日・終了日を含める。

### 遅延到着ディメンション（Late Arriving Dimensions）

> "When facts arrive before their corresponding dimension data, special dimension rows are created with unresolved natural keys and generic unknown values. When the dimensional context is eventually supplied, the placeholder dimension rows are updated."
> — [Kimball Group, Late Arriving Dimensions](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/late-arriving-dimension/)

ファクトデータに先立ってディメンションコンテキストが到着しない場合の対応。一時的なプレースホルダー・ディメンション行を作成し、コンテキストが揃った時点でType 1上書きで更新する。

### 役割確認ディメンション（Role-Playing Dimensions ＋ Type 2 SCD の複合）

ロールプレイングディメンションがSCD Type 2を採用している場合、各役割（例：注文日・出荷日）に対して独立したビューを通じて正しい時点のディメンション属性を取得できる。

### 階層ブリッジテーブル（Hierarchy Bridge Tables）

不規則な可変深さ階層を処理するためのブリッジテーブル。各行がある階層ノードから別のノードへのパス（すべての中間レベルを含む）を表す。標準SQLでの全種類の階層トラバースを可能にする。

### タイムスタンプ付き行の管理（Time Stamped Rows）

Type 2 SCDの管理において、行の有効期間（開始日・終了日）と現在行フラグを持つカラムを追加する設計パターン。

### 監査ディメンション（Audit Dimension）

> "When a fact table row is created in the ETL back room, it is helpful to create an audit dimension containing the ETL processing metadata known at the time."
> — [Kimball Group, Audit Dimension](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/audit-dimension/)

ETLプロセスが実行された際に生成されるメタデータを含むディメンション。活用情報例：

- データ品質インジケーター
- ETLコードのバージョン情報
- ETL処理実行タイムスタンプ

BI層のレポートからデータ系譜・信頼性の追跡に使用される。

---

## 特別目的スキーマ（Special Purpose Schemas）

### 異種商品のスーパータイプ/サブタイプスキーマ（Supertype and Subtype Schemas for Heterogeneous Products）

> "Attempts to build a single consolidated fact table with the union of all possible facts for disparate product lines will fail. The solution is to build a single supertype fact table with the intersection of common facts, plus separate subtype fact tables for each product type."
> — [Kimball Group, Supertype and Subtype Schemas](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/supertype-subtype-heterogeneous/)

金融機関が提供する多種多様な商品（当座預金・住宅ローン・事業融資など）を管理するためのスキーマ設計。

**構成：**
1. **スーパータイプファクトテーブル**：全商品タイプに共通するファクトと属性
2. **サブタイプファクトテーブル**：各商品タイプ固有のファクトと属性

### リアルタイムファクトテーブル（Real-Time Fact Tables）

> "Real-time fact tables need to be updated more frequently than nightly batch loads. Techniques include hot partitions pinned in physical memory with indexes deliberately not built."
> — [Kimball Group, Real-Time Fact Tables](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/realtime-fact-table/)

従来のナイトリーバッチ処理より高頻度の更新が必要なファクトテーブル。技術的手法例：

- **ホットパーティション**：物理メモリにピン留めされたパーティション（集計・インデックスなし）
- **ETLセンシング**：運用システムから連続的にデータを取得
- **ストリームデータ**：リアルタイムデータストリームからの直接ロード

### エラーイベントスキーマ（Error Event Schemas）

> "When a data quality screen detects an error, this event is recorded in a special dimensional schema available only in the ETL back room."
> — [Kimball Group, Error Event Schemas](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)

ETLパイプライン中のデータ品質問題を管理するための特殊スキーマ。

**構成：**
1. **エラーイベントファクトテーブル**：粒度 = 個々のエラーイベント
2. **エラーイベント詳細ファクトテーブル**：粒度 = エラーに関与した各テーブルの各列

---

## ディメンショナルモデリングの10の基本ルール

Kimball Groupが定める「10 Essential Rules of Dimensional Modeling」：

> "These rules apply regardless of the industry, business process, or data type."
> — [Kimball Group, 10 Essential Rules](https://www.kimballgroup.com/2009/05/the-10-essential-rules-of-dimensional-modeling/)

1. **原子的な詳細データの格納**：予測不可能なクエリに対応できるよう、最も粒度の細かいデータを格納する
2. **ビジネスプロセス中心の構造**：各測定イベントは独立したファクトテーブルに対応させる
3. **日付ディメンションの必須化**：すべてのファクトテーブルに少なくとも一つの日付外部キーを持たせる
4. **粒度の統一**：一つのファクトテーブル内のすべての測定値は同じ詳細レベルを持つ
5. **多対多関係のブリッジテーブルによる解決**：外部キーをNULLにしない
6. **多対一関係のディメンション内非正規化**：階層関係はディメンションテーブルでフラット化する
7. **コードとデコードのディメンション格納**：レポートラベルはディメンションに格納し、ファクトテーブルをシンプルに保つ
8. **サロゲートキーの使用**：意味を持たない連番キーでファクトテーブルのサイズを削減し、パフォーマンスを向上させる
9. **コンフォームドディメンションの作成**：複数のファクトテーブルで共通ディメンションを再利用する
10. **要件と現実のバランス**：実装可能でビジネスユーザーに採用しやすい設計を目指す

---

## 重要人物・文献

### Ralph Kimball（ラルフ・キンボール）

1944年生まれ。スタンフォード大学電気工学博士。ゼロックスPARCでXerox Starワークステーションの主任設計者を務めた後、データウェアハウス分野に転向。1996年の著書 *The Data Warehouse Toolkit* でディメンショナルモデリングを体系化し、業界標準を確立した。

### Margy Ross（マーギー・ロス）

Ralph Kimballとともに Kimball Group を共同創設。*The Data Warehouse Toolkit* 第3版の共著者。数十年にわたりKimball式の普及・発展に貢献した。

### 主要著作・文献

- **Ralph Kimball & Margy Ross** (2013). *The Data Warehouse Toolkit: The Definitive Guide to Dimensional Modeling, 3rd Edition*. Wiley. ISBN: 978-1-118-53080-1
- **Kimball Group** (2013). *Kimball Dimensional Modeling Techniques* [PDF]. [https://www.kimballgroup.com/wp-content/uploads/2013/08/2013.09-Kimball-Dimensional-Modeling-Techniques11.pdf](https://www.kimballgroup.com/wp-content/uploads/2013/08/2013.09-Kimball-Dimensional-Modeling-Techniques11.pdf)
- **Kimball Group** (2009). *The 10 Essential Rules of Dimensional Modeling*. [https://www.kimballgroup.com/2009/05/the-10-essential-rules-of-dimensional-modeling/](https://www.kimballgroup.com/2009/05/the-10-essential-rules-of-dimensional-modeling/)
- **Kimball Group** (2013). *Design Tip #152: Slowly Changing Dimension Types 0, 4, 5, 6 and 7*. [https://www.kimballgroup.com/2013/02/design-tip-152-slowly-changing-dimension-types-0-4-5-6-7/](https://www.kimballgroup.com/2013/02/design-tip-152-slowly-changing-dimension-types-0-4-5-6-7/)
- **Kimball Group** (1997). *A Dimensional Modeling Manifesto*. [https://www.kimballgroup.com/1997/08/a-dimensional-modeling-manifesto/](https://www.kimballgroup.com/1997/08/a-dimensional-modeling-manifesto/)

---

## 最新動向・現代的文脈

### クラウドデータウェアハウスとの関係

BigQuery、Snowflake、Databricks等のクラウドデータウェアハウスの登場により、ディメンショナルモデリングの一部の前提が変わった。以前はストレージ効率のためにスノーフレーク化が議論されたが、現代のクラウドDWHではフルスキャンのコストが低下し、非正規化されたスタースキーマが一層有利になった。

SCDについても、クラウドDWH環境ではType 2の実装コストが大幅に低下しており、ほぼすべての変更追跡シナリオで有効である。

### dbtとの統合

dbtなどの現代的なデータ変換ツールを使ってKimball式スタースキーマを構築する実践が広く普及している。dbtのマクロやモデル設計のベストプラクティスとして、Kimball式の命名規則とテーブル設計が採用されている。

> "Ralph established an extensive portfolio of dimensional techniques and vocabulary...and the list goes on. These are all now part of the industry's common vocabulary."
> — [dbt Developer Blog, Building a Kimball dimensional model with dbt](https://docs.getdbt.com/blog/kimball-dimensional-model)

### データレイクハウスとの組み合わせ

Data LakehouseアーキテクチャにおいてもKimball式のロジックは有効であり、Deltaテーブル等を使ったスタースキーマの実装が増えている。

### ワン・ビッグ・テーブル（OBT）との対比

近年、パフォーマンス最適化やシンプルさを優先して、すべてのディメンション情報をファクトに結合した「ワン・ビッグ・テーブル（OBT）」アプローチも注目されている。多くの実践者はKimball式とOBTを組み合わせたハイブリッドアプローチを採用している。

---

## 関連トピック

- **データヴォルト（Data Vault）**：エンタープライズDWHのための別の設計手法。Kimball式と組み合わせて使用されることも多い
- **OLAP（Online Analytical Processing）**：スタースキーマの論理的な多次元ビュー
- **ETL（Extract, Transform, Load）**：ディメンショナルモデルへのデータロードプロセス
- **マスターデータ管理（MDM）**：コンフォームドディメンションの実現を支援
- **pgflow・dbtなどのモダンデータスタック**：Kimball式設計の自動化・バージョン管理
- **Apache Spark / Delta Lake**：大規模Kimball式実装のためのプラットフォーム

---

## 参考リンク

- [Kimball Group公式 – Dimensional Modeling Techniques一覧](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)
- [Design Tip #152 – SCD Types 0, 4, 5, 6, 7](https://www.kimballgroup.com/2013/02/design-tip-152-slowly-changing-dimension-types-0-4-5-6-7/)
- [Design Tip #142 – Building Bridges (Bridge Tables)](https://www.kimballgroup.com/2012/02/design-tip-142-building-bridges/)
- [Design Tip #166 – Potential Bridge Table Detours](https://www.kimballgroup.com/2014/05/design-tip-166-potential-bridge-table-detours/)
- [Design Tip #127 – Creating and Managing Mini-Dimensions](https://www.kimballgroup.com/2010/09/design-tip-127-creating-and-managing-mini-dimensions/)
- [Design Tip #51 – Latest Thinking on Time Dimension Tables](https://www.kimballgroup.com/2004/02/design-tip-51-latest-thinking-on-time-dimension-tables/)
- [The 10 Essential Rules of Dimensional Modeling](https://www.kimballgroup.com/2009/05/the-10-essential-rules-of-dimensional-modeling/)
- [Enterprise Data Warehouse Bus Architecture](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/kimball-data-warehouse-bus-architecture/)
- [Kimball Group Forum – Modelling Many-to-Many Relationships](https://kimballgroup.forumotion.net/t2935-modelling-many-to-many-relationships-in-a-dimension)
- [Wikipedia – Slowly Changing Dimension](https://en.wikipedia.org/wiki/Slowly_changing_dimension)
- [Wikipedia – Ralph Kimball](https://en.wikipedia.org/wiki/Ralph_Kimball)
- [Holistics.io – Kimball's Dimensional Data Modeling](https://www.holistics.io/books/setup-analytics/kimball-s-dimensional-data-modeling/)
- [dbt Developer Blog – Building a Kimball dimensional model with dbt](https://docs.getdbt.com/blog/kimball-dimensional-model)
- [Handling Hierarchies in Dimensional Modeling (Towards Data Science)](https://towardsdatascience.com/handling-hierarchies-in-dimensional-modeling-176156f20f61/)
- [Multivalued Dimensions and Bridge Tables (Medium)](https://medium.com/@meruert.sm/multivalued-dimensions-and-bridge-tables-9dde5001988c)
