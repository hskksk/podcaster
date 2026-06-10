# OLAPデータモデリング完全解説：手法と特定要件への対応

## 概要

OLAP（Online Analytical Processing）向けのデータモデリングは、大量のビジネスデータを高速に集計・分析するための設計技術体系だ。OLTP（Online Transaction Processing）が個々のトランザクション処理を重視するのに対し、OLAPは「年度別・地域別・製品カテゴリ別の売上はどうか」「四半期ごとの在庫推移は」といった多次元的な問いに答えるために最適化されている。

なぜこの分野が面白いかといえば、単純に「テーブルをきれいに作る」という話ではないからだ。どのモデリング手法を選ぶかは、クエリ速度・更新コスト・履歴追跡の可否・多数のソースシステムへの対応力など、互いにトレードオフのある複数の軸を同時に考慮する設計判断だ。そしてビジネス要件が多様化するにつれ、「多通貨を扱う」「組織階層が不規則」「遅延到着データがある」「バイテンポラル追跡が必要」といった特定の難題が次々と登場する。本稿ではKimball流ディメンショナルモデリングを軸に、Data Vault、OBT、集計・マテリアライズドビューを横断しながら、特定要件への対応手法を幅広く掘り下げる。

---

## 背景・歴史

OLAPという概念は1993年、E.F. Coddがリレーショナルデータベースの父として知られる立場から、多次元分析のための12のルールを提唱したことに始まる。翌1994年、Ralph KimballとBill Inmonがそれぞれ独自のデータウェアハウス設計論を確立した。

- **Inmonアプローチ（トップダウン）**：企業全体の正規化されたエンタープライズデータウェアハウス（EDW）を中央に置き、そこから各部門向けのデータマートを派生させる。データ品質・整合性を優先するが、構築コストが大きい。
- **Kimballアプローチ（ボトムアップ）**：ビジネスプロセスごとにディメンショナルモデル（スタースキーマ）のデータマートを作り、統一ディメンションで連携させる。BIツールへの親和性が高く、段階的な拡張が可能。

2000年代に入ってビッグデータ・クラウドDWHが台頭すると、Dan Linstedtが提唱した**Data Vault**モデリングが複数ソースシステムの統合や完全な変更履歴追跡の文脈で注目を集めた。さらに2010年代後半からは、クラウドDWHのストレージコスト低下とカラムナーエンジンの進化を背景に、**OBT（One Big Table）**という「とにかく1枚の幅広テーブルに非正規化して高速スキャン」という逆張りアプローチも実用的な選択肢として浮上してきた。

---

## 核となる概念

### グレイン（Grain）の宣言

ディメンショナルモデリングにおける最初にして最重要のステップが**グレイン宣言**だ。グレインとはファクトテーブルの1行が何を表すかを定義することで、「1取引1行」「1日1製品1倉庫1行」のように具体的かつ一意に定まる必要がある。

グレインを宣言する前にディメンションやファクトを決めてはいけない。グレインはすべての設計判断の「契約書」であり、あとから変えると全体を作り直すことになる。Kimballは「アトミックグレイン（最も細かい粒度）から始めよ」と強調する。細かすぎると思っても、後から集計するのは容易だが、粒度を細かくする方向への変更は困難だからだ。

### ファクトテーブル

ファクトテーブルはビジネスプロセスの「測定値」を保持する。売上金額・数量・時間・コストなどの数値がファクトであり、残りの外部キーがディメンションへのポインタになる。

**ファクトの加法性**は重要な設計上の分類だ：
- **完全加法的（Additive）**：どのディメンションでSUMしても意味がある（例：売上金額）
- **半加法的（Semi-Additive）**：一部のディメンションでは合計できない（例：残高・在庫量 → 時間軸ではSUM不可）
- **非加法的（Non-Additive）**：いかなるディメンションでも合計に意味がない（例：利益率・比率）

### ディメンションテーブル

ファクトへの「コンテキスト」を与える記述的な情報を保持する。「誰が・何を・どこで・いつ・なぜ」に相当する属性群だ。ディメンションはクエリのフィルタリング・グルーピング・ラベリングに使われる。

---

## ファクトテーブルの設計と種類

### トランザクション型ファクトテーブル（Transaction Fact Table）

最も基本的な形式で、個々のビジネスイベントを1行として記録する。「販売1件」「クリック1回」「コール1本」がそれにあたる。

- **特徴**：粒度が最も細かく、データ量が最大になりやすい
- **強み**：「何件起きたか（intensity）」「合計いくらか」の問いに最適
- **注意**：スパースになりがち（起きなかったイベントは記録されない）

```sql
-- 例：売上トランザクションファクト
CREATE TABLE fact_sales (
  date_key        INT,         -- 日付ディメンションFK
  product_key     INT,         -- 製品ディメンションFK
  customer_key    INT,         -- 顧客ディメンションFK
  store_key       INT,         -- 店舗ディメンションFK
  sales_amount    DECIMAL(12,2),
  quantity_sold   INT,
  discount_amount DECIMAL(12,2)
);
```

### 周期的スナップショット型（Periodic Snapshot Fact Table）

一定の期間ごと（日次・週次・月次など）に状態を記録する。トランザクションが発生しなかった期間も「ゼロ」として記録される点がトランザクション型との違いだ。

- **代表例**：日次在庫残高、月末口座残高、週次進捗レポート
- **強み**：時系列トレンド分析に優れる。「先月末時点の在庫」を即座にクエリできる
- **半加法的ファクトの扱い**：残高のような半加法的ファクトはこの形式との相性が良い。時間ディメンション以外ではSUM可能、時間軸ではSUM不可でMAX/MIN/AVGを使う

```sql
-- 例：日次在庫スナップショット
CREATE TABLE fact_inventory_daily (
  date_key        INT,
  product_key     INT,
  warehouse_key   INT,
  qty_on_hand     INT,         -- 半加法的：横断集計OK、時間軸SUM不可
  qty_on_order    INT,
  qty_reserved    INT
);
```

### 累積スナップショット型（Accumulating Snapshot Fact Table）

開始から終了までの定義されたワークフローやパイプラインの全体像を1行に収める。受注→出荷→請求→入金といった各マイルストーンの日付がすべて同じ行に入る。

- **代表例**：受注処理パイプライン、ローン審査プロセス、製造工程
- **特徴**：行が「更新」される（各マイルストーン通過時に対応する日付キーが埋まっていく）。他の2種が基本的に追記専用なのとは異なる
- **強み**：「平均リードタイム」「ステージ間の滞留時間」の分析に最適
- **注意**：SCD Type 1的な上書きが発生するため、変更履歴は別途audit logで管理する

```sql
-- 例：受注パイプラインの累積スナップショット
CREATE TABLE fact_order_pipeline (
  order_key           INT,
  customer_key        INT,
  product_key         INT,
  order_date_key      INT,
  ship_date_key       INT,     -- まだ出荷前はNULL（またはUnknown行のSK）
  invoice_date_key    INT,
  payment_date_key    INT,
  lag_order_to_ship   INT,     -- 日数差（マイルストーン到達後に計算）
  lag_ship_to_invoice INT,
  order_amount        DECIMAL(12,2)
);
```

### ファクトレスファクトテーブル（Factless Fact Table）

数値的なメジャーを持たず、イベントの「発生有無」や「関係性」だけを記録する。

- **代表例①（イベント記録）**：授業への出席、ウェブページの訪問、プロモーション露出
- **代表例②（カバレッジ）**：「対象になりうるが実際には購入しなかった顧客」を特定するために使う
- **使い方**：「このプロモーションを見たが購入しなかった顧客の割合」を計算するには、プロモーション露出ファクトレステーブルと売上ファクトテーブルを比較する

---

## ディメンションテーブルの設計と種類

### 統一ディメンション（Conformed Dimension）

複数のファクトテーブルやデータマートで**同じ定義・同じキー・同じ属性**を持つディメンション。例えば「日付ディメンション」を全データマートで共有すれば、売上マートと在庫マートを日付軸でクロスドリルできる。

統一ディメンションはエンタープライズバスマトリックスで管理し、どのビジネスプロセスがどのディメンションを共有するかを明示的に定義する。

### デジェネレートディメンション（Degenerate Dimension）

ディメンションテーブルを持たないディメンションキーで、ファクトテーブルに直接格納される。受注番号・請求書番号・POSトランザクションIDがその典型だ。

- **理由**：これらは通常、属性を持たない（あっても全てファクトに内包済み）ため、別テーブルを作る意義がない
- **使い方**：ドリルダウンの終点として機能し、詳細トランザクションへのリンクになる

### ジャンクディメンション（Junk Dimension）

カーディナリティの低いフラグや指標（Yes/No型フィールド、ステータスコードなど）を一つのテーブルにまとめたもの。例えば「支払い方法」「プロモーション適用有無」「返品フラグ」を個別に持つとファクトテーブルが数十のフラグ列で溢れかえる問題を解決する。

- **設計**：全フラグの組み合わせの直積を事前に生成し、各組み合わせにサロゲートキーを割り当てる
- **カーディナリティ管理**：フラグ数が増えると組み合わせ数が爆発するため、意味的に近いグループごとに複数のジャンクディメンションに分割する

### ロールプレイングディメンション（Role-Playing Dimension）

1つの物理テーブルが同一ファクトテーブルで複数の役割を担う。日付ディメンションが最典型例で、受注日・出荷日・請求日のすべてが同じ `dim_date` を参照するが、異なるエイリアスで結合される。

```sql
-- ロールプレイングの結合例
SELECT
  o.order_date_key,
  d1.full_date AS order_date,
  d2.full_date AS ship_date,
  d3.full_date AS invoice_date
FROM fact_orders o
JOIN dim_date d1 ON o.order_date_key = d1.date_key
JOIN dim_date d2 ON o.ship_date_key = d2.date_key
JOIN dim_date d3 ON o.invoice_date_key = d3.date_key;
```

BIツールでは各エイリアスを別ディメンションとして「ビュー」を作成することで、エンドユーザーの混乱を防ぐ。

### アウトリガーディメンション（Outrigger Dimension）

ディメンションテーブルから参照される別のディメンションテーブル。例えば `dim_store` が `dim_geography` を参照する場合などだが、Kimballはこれを一般的に非推奨としている。スノーフレーク化はクエリの複雑さを増し、BIツールとの相性が悪いためだ。本当に必要な場合にのみ使用する。

### サロゲートキーとナチュラルキー

ディメンションのサロゲートキー（代理キー）は整数型の連番で、ソースシステムのナチュラルキー（自然キー）とは別に生成する。これにより：
- ソースシステムのキー変更から隔離できる
- SCD Type 2での履歴管理が可能になる（同一エンティティが複数行を持てる）
- パフォーマンス（整数での結合は文字列より高速）

---

## スローリーチェンジングディメンション（SCD）

ディメンションの属性は時間とともに変化する。顧客の住所が変わる、製品カテゴリが再分類される、従業員の部署が変わる……。このような「ゆっくり変化する属性」をどう扱うかがSCDの核心だ。

### Type 0：変化しない（Retain Original）

変更を一切受け付けない。初期値を永久保持する。初期登録時の値に意味がある場合（例：最初の購入チャンネル）に適用する。

### Type 1：上書き（Overwrite）

古い値を新しい値で上書きする。履歴は消える。

- **適用場面**：誤りの修正、履歴が不要な属性（電話番号の修正など）
- **欠点**：「変更前の売上」を変更前のカテゴリで集計できなくなる

### Type 2：新規行追加（Add New Row）

変更が起きるたびに新しい行を追加し、`effective_date` / `expiry_date` と `is_current` フラグで管理する。実務での主力手法。

```sql
-- SCD Type 2 の例
customer_key | customer_id | name   | region  | effective_from | effective_to | is_current
101          | CUST_001    | 山田太郎 | 東京    | 2020-01-01    | 2023-06-30  | FALSE
102          | CUST_001    | 山田太郎 | 大阪    | 2023-07-01    | 9999-12-31  | TRUE
```

- **適用場面**：履歴ベースの分析が必要な場合（「転居前の地域での購買傾向は？」）
- **注意**：ファクトテーブルは特定時点のサロゲートキーを参照するため、「その時点のコンテキスト」での分析が自動的に成立する

### Type 3：属性追加（Add New Attribute）

現在値と1つ前の値を別カラムとして保持する。

```sql
customer_key | region_current | region_previous | effective_date
101          | 大阪           | 東京           | 2023-07-01
```

- **適用場面**：「現在と直前の比較」だけが必要で、それ以上の履歴は不要な場合
- **欠点**：さらに前の値や複数回の変更追跡が困難

### Type 4：履歴テーブル分離

現在テーブルと別の履歴テーブルに分ける。現在テーブルのクエリは高速、履歴テーブルは完全な変更記録を保持する。

### Type 6：ハイブリッド（1+2+3）

Type 2の行管理を基本としながら、現在値をどの行でも保持するカラムを追加する（Type 1の上書き）。さらにType 3のように前回値カラムも持つ。

```sql
customer_key | customer_id | region  | region_current | effective_from | effective_to | is_current
101          | CUST_001    | 東京    | 大阪           | 2020-01-01    | 2023-06-30  | FALSE
102          | CUST_001    | 大阪    | 大阪           | 2023-07-01    | 9999-12-31  | TRUE
```

- **強み**：`region_current` により「今の地域で全履歴を集計」と「当時の地域で集計」の両方ができる
- **適用場面**：「当時のセグメント分析」と「現在のセグメントベースの全期間分析」を並行して提供したい場合

### Type 7：デュアルキー

ファクトテーブルが現在サロゲートキーと過去版のサロゲートキーの両方を持つ。BIツールがどちらのキーで結合するかで「現在軸分析」と「履歴軸分析」を切り替える。

---

## ブリッジテーブルと多対多の扱い

### 問題の本質

通常のスタースキーマはファクトとディメンションが1対多の関係を前提とする。しかし現実のビジネスでは多対多が頻出する：
- 1件の医療請求に対する複数の診断コード
- 1つの銀行口座に対する複数の口座保有者
- 1つのプロジェクトに対する複数のスキルタグ

これらを直接ファクトテーブルで扱うと行が爆発的に増え（グレインが崩れる）、集計に二重カウントが生じる。

### ブリッジテーブルの構造

ファクトテーブルとディメンションの間に「ブリッジ（仲介）テーブル」を挟む。ブリッジテーブルはグループキーでファクトと結合し、個々のディメンションキーでディメンションと結合する。

```
fact_claims
  ↓ claim_key → bridge_claim_diagnosis (claim_key, group_key)
                    ↓ group_key + dx_code_key → dim_diagnosis
```

### 重み付け係数（Weighting Factor）

多対多の集計で二重カウントを避けるための重要な仕組みが**重み付け係数**だ。各ブリッジ行にウェイトを付与し、合計が1になるように正規化する。

```sql
bridge_claim_diagnosis:
claim_group_key | dx_code_key | weight
1               | DX_001      | 0.5    -- 主診断 50%
1               | DX_002      | 0.5    -- 副診断 50%
```

クエリ時にファクトの金額にウェイトを掛けることで、診断コード別の正確な配分額が計算できる。ウェイトの計算ロジックはビジネスルールによって異なる（均等割、主診断優先など）。

### 階層の多対多：クロージャーテーブル

組織ツリーや製品カテゴリのような階層を多対多で扱う場合、**クロージャーテーブル（Closure Table）**が有効だ。すべての祖先・子孫の関係（深さゼロから最深部まで）を事前に展開して保存することで、再帰クエリなしに「営業部門とその配下全員の売上合計」が高速に計算できる。

---

## 集計とマテリアライズドビュー

### なぜ事前集計が必要か

アトミックグレインのファクトテーブルはクエリの柔軟性が高いが、数十億行のテーブルで毎回集計するのはコストが高い。マテリアライズドビューや集計テーブルは、このトレードオフを解決するための事前計算メカニズムだ。

### マテリアライズドビュー

マテリアライズドビューとは、集計・結合クエリの結果を物理的に保存したテーブルだ。クエリエンジンはベーステーブルを再スキャンする代わりに、このキャッシュを参照する。

- **メリット**：クエリ速度の大幅向上（GROUP BYコストの排除）
- **デメリット**：追加のストレージと、リフレッシュ時のメンテナンスコスト
- **自動クエリリライト**：BigQuery・Snowflake・Redshiftなど主要クラウドDWHは、マテリアライズドビューに対応するクエリを自動的に書き換えて高速化する機能を持つ

```sql
-- 月次売上集計のマテリアライズドビュー例
CREATE MATERIALIZED VIEW mv_monthly_sales AS
SELECT
  d.year,
  d.month,
  p.category,
  SUM(f.sales_amount) AS total_sales,
  COUNT(*) AS transaction_count
FROM fact_sales f
JOIN dim_date d ON f.date_key = d.date_key
JOIN dim_product p ON f.product_key = p.product_key
GROUP BY d.year, d.month, p.category;
```

### 集計ファクトテーブル

マテリアライズドビューとは別に、明示的に粒度を上げた集計ファクトテーブルを作成することもある。Kimballはこれを「集約ファクトテーブル（Aggregate Fact Table）」と呼ぶ。アトミックテーブルと集計テーブルを共存させ、BIツールが自動的に適切な粒度を選択するよう設計する（エージャゲート・ナビゲーター）。

---

## Data Vaultモデリング

### 基本哲学

Dan Linstedtが提唱したData Vaultは、「ソースシステムが変わっても中核データ構造は変えない」という設計思想から生まれた。ハブ・リンク・サテライトの3種類のテーブルのみで全データを表現する。

### ハブ（Hub）

ビジネスエンティティの「ビジネスキー（自然キー）」のみを保持する。ハブはエンティティのIDの最もシンプルな表現であり、属性は一切持たない。

```sql
CREATE TABLE hub_customer (
  customer_hk     CHAR(32),    -- ハッシュキー（ビジネスキーのMD5）
  customer_bk     VARCHAR(50), -- ビジネスキー（顧客コードなど）
  load_dts        TIMESTAMP,
  record_source   VARCHAR(100)
);
```

### リンク（Link）

ハブ間の関係（多対多含む）を保持する。外部キーとして各ハブのハッシュキーを持つ。

```sql
CREATE TABLE link_order_product (
  order_product_hk CHAR(32),
  order_hk         CHAR(32),   -- hub_orderへのFK
  product_hk       CHAR(32),   -- hub_productへのFK
  load_dts         TIMESTAMP,
  record_source    VARCHAR(100)
);
```

### サテライト（Satellite）

ハブやリンクに関連する属性と履歴を保持する。変更のたびに新規行が追加され、完全な変更履歴が保持される（SCD Type 2と同様の効果）。

```sql
CREATE TABLE sat_customer_details (
  customer_hk   CHAR(32),
  load_dts      TIMESTAMP,   -- このバージョンの開始時刻
  load_end_dts  TIMESTAMP,   -- このバージョンの終了時刻（nullable）
  name          VARCHAR(100),
  email         VARCHAR(200),
  region        VARCHAR(50),
  hash_diff     CHAR(32)     -- 属性値の変化検出用ハッシュ
);
```

### Data Vaultの特徴と使いどころ

**強み：**
- 新しいソースシステムの追加がハブ・サテライトの追加だけで済み、既存構造を変えない
- すべての変更が完全に記録される（コンプライアンス・監査に有利）
- 並列ロードが容易（ハブ・リンク・サテライト間に依存関係が少ない）

**弱み：**
- クエリが複雑（BIツールからは直接使いにくい）
- 小規模・単一ソースシステムへの適用はオーバーエンジニアリング

**実務パターン**：生データ層にData Vaultで統合・履歴管理し、プレゼンテーション層にKimballスタースキーマのデータマートを生成する「ハイブリッドアーキテクチャ」が主流。

---

## OBT（One Big Table）

### 発想の逆転

OBTとは、スタースキーマのような複数テーブル構成ではなく、すべてのデータを一枚の非常に幅広いテーブルに非正規化して収める設計だ。

```sql
-- OBTの例（結合不要で全属性にアクセス可能）
CREATE TABLE wide_sales (
  sale_id          BIGINT,
  sale_date        DATE,
  sale_year        INT,
  sale_month       INT,
  customer_id      VARCHAR(50),
  customer_name    VARCHAR(100),
  customer_region  VARCHAR(50),
  product_id       VARCHAR(50),
  product_name     VARCHAR(100),
  product_category VARCHAR(50),
  sales_amount     DECIMAL(12,2),
  quantity_sold    INT
  -- ...他多数のデスネスト済み属性
);
```

### スタースキーマとの比較

| 観点 | スタースキーマ | OBT |
|------|------------|-----|
| クエリ速度 | 結合コストあり | スキャンのみで高速 |
| ストレージ | 効率的（正規化） | 冗長（繰り返しデータ多い） |
| 更新コスト | ディメンション更新のみ | 全行更新が必要 |
| 柔軟性 | 高い（多様なクエリ） | 固定的な用途に最適 |
| 整合性リスク | 低い | 高い（重複データの不整合） |

### OBTが有効な場面

- クエリパターンが固定されており、高速なスキャンが最優先の用途
- ClickHouseやDuckDBなど、カラムナーストレージで幅広テーブルを得意とするエンジンを使う場合
- リアルタイム分析でUPSERTが頻発する場合（Pinot/Druidなど）
- BI向け「セマンティックレイヤー」の手前に置く1枚のソーステーブルとして

---

## 特定要件への対応：モデリングパターン詳解

OLAPモデリングで最も難しいのは、一般論ではなく「この特定の要件をどう正しく表現するか」だ。以下、幅広い特定要件とその対処パターンを取り上げる。

### 要件1：多通貨・為替レート

多通貨を扱う財務データは、集計時に「どの通貨で比較するか」が本質的に難しい。

**パターン：2列保持法（Kimball推奨）**

取引ファクトテーブルに「取引通貨の金額」と「標準通貨（例：USD）の金額」を両方保持する。標準通貨への変換はETL時に承認済みの為替レートを適用する。

```sql
fact_sales:
  transaction_currency_code  CHAR(3),      -- 'JPY', 'EUR', etc.
  amount_local               DECIMAL(15,4), -- 現地通貨の金額
  amount_usd                 DECIMAL(15,4)  -- 標準通貨の金額
```

**為替レートファクトテーブル**

為替レートは時間とともに変化するため、別のファクトテーブルとして管理する：

```sql
fact_exchange_rate:
  date_key             INT,
  from_currency_key    INT,
  to_currency_key      INT,
  exchange_rate        DECIMAL(15,6),
  rate_type            VARCHAR(20)  -- 'EOD', 'Average', 'Spot'
```

**注意点**：為替レートは非加法的（複数通貨の合計レートには意味がない）。金額は加法的だが、変換済みの金額を合計する必要がある。

**動的変換パターン**：クエリ時に変換したい場合は、クエリ側で為替レートを掛け合わせる。ただしパフォーマンスへの影響が大きい。ETL時変換とクエリ時変換のどちらを選ぶかは、「為替レートの後から修正可能性」と「クエリの柔軟性」のトレードオフだ。

### 要件2：階層データ（固定・不規則・再帰）

#### 固定深度の均衡階層

地域（国→地域→都道府県→市区町村）や時間（年→四半期→月→日）のような固定深度階層は、各レベルを属性として直接ディメンションに展開できる（非正規化）。

```sql
dim_geography:
  geo_key        INT,
  city           VARCHAR(100),
  prefecture     VARCHAR(100),
  region         VARCHAR(50),
  country        VARCHAR(50)
```

#### 不規則階層（Ragged Hierarchy）

組織図の例：CEOの直属に事務員がいる一方で、本部長→部長→課長→担当者という4層もある。不規則階層はレベルによって意味が変わる（「課長レベル」は事業部門によって深さが違う）。

**対応パターン①：スキップレベル**

存在しないレベルには上位レベルの値をコピーして埋め、クエリで `null` を避ける。BIツールが「スキップ」を表示できるよう、`is_leaf` フラグを持つ。

**対応パターン②：親子テーブル**

```sql
dim_employee:
  employee_key  INT,
  employee_id   VARCHAR(20),
  name          VARCHAR(100),
  manager_key   INT   -- 自己参照（再帰）
```

クロージャーテーブルと組み合わせると、再帰クエリなしに階層集計が可能になる。

```sql
-- クロージャーテーブル：全先祖・子孫ペアを事前展開
closure_employee:
  ancestor_key  INT,
  descendant_key INT,
  depth         INT   -- 0=自己, 1=直属, 2=孫, ...
```

**対応パターン③：パス列挙（Path Enumeration）**

各ノードにルートからのパスを文字列で持つ。`/1/4/7/12/` のような形式で、LIKE演算子やLEFT()で階層クエリができる。読み取りが容易だが、再構成時のメンテナンスコストが高い。

### 要件3：バイテンポラルデータ（二時相データ）

通常の「有効時間（Valid Time）」に加え、「トランザクション時間（Transaction Time）」を両方管理する設計。

- **有効時間（Valid Time）**：その情報が現実世界で真である期間（例：保険の適用期間）
- **トランザクション時間（Transaction Time）**：データベースにその情報が記録された期間（例：システムに入力された日時）

```sql
-- バイテンポラルのSCD Type 2例
customer_key | version | valid_from | valid_to   | recorded_from      | recorded_to
101          | 1       | 2020-01-01 | 2023-06-30 | 2020-01-05 09:00   | 9999-12-31
102          | 2       | 2023-07-01 | 9999-12-31 | 2023-07-02 14:00   | 9999-12-31
103          | 1*      | 2020-01-01 | 2023-06-30 | 2023-07-10 11:00   | 9999-12-31
-- *後から誤りを修正したことを記録（transaction timeで追跡）
```

**用途**：金融・保険・医療など、「いつの時点のデータか」と「いつその情報を知ったか」を別々に追跡する必要がある規制対応業界で特に重要。「as-of」クエリ（「2023年1月1日時点で存在していた顧客レコードを、2022年12月31日の情報で見よ」）が可能になる。

### 要件4：遅延到着データ（Late Arriving Data）

ネットワーク遅延、バッチ処理の遅れ、外部システムからのデータ供給の不整合などにより、ファクトやディメンションが本来あるべき時刻より遅れて届くことがある。

**遅延到着ファクトの処理**

イベント発生日にSCD Type 2で有効だったサロゲートキーを特定し、遅延して届いたファクトを正しいサロゲートキーで挿入する。

```python
# 疑似コード
def insert_late_arriving_fact(event_date, natural_key, fact_data):
    # event_dateに有効だったサロゲートキーを検索
    dim_key = lookup_dimension_at_date(natural_key, event_date)
    if dim_key is None:
        dim_key = UNKNOWN_KEY  # Unknownディメンション行
    insert_fact(dim_key, fact_data)
```

**遅延到着ディメンションの処理**

ファクトが先に来てディメンションがまだ存在しない場合、「プレースホルダー」ディメンション行を作成する。主要属性は「Unknown」、識別可能な自然キーのみセット。ディメンションが後から届いたらType 1で上書きする。

### 要件5：スパースデータ

多くのディメンションの組み合わせでファクトが存在しない場合（例：10万製品×365日×1000店舗だがほとんどの組み合わせで売上ゼロ）、スパース問題が発生する。

**対応策①：トランザクション型の採用**

ゼロ行を記録しないトランザクション型ファクトテーブルを使い、「ゼロの判定」はクエリ時に行う（NULL = 取引なし）。

**対応策②：スパース列対応の物理設計**

カラムナーストレージはNULLの圧縮効率が高い。多くの場合、明示的なゼロ行より「行自体がない」方がストレージ効率は良い。

**対応策③：ゼロ抑制（Zero Suppression）**

レポートの表示レイヤーで、ゼロや NULL のみの行・列を事前にフィルタリングする。

### 要件6：半加法的・非加法的メジャー

**半加法的メジャーの設計**

在庫残高・口座残高などは「時間軸でのSUM」に意味がない。周期的スナップショットテーブルと組み合わせ、時間軸ではMAX/MIN/AVG/LAST_VALUEを使う。BIツール側で「時間軸以外はSUM、時間軸はAVG」とメジャー定義する。

```sql
-- 月末残高の正しい集計
SELECT
  d.year,
  d.month,
  a.account_type,
  -- 時間軸での集計はAVGまたはLAST VALUE
  AVG(f.balance_amount) AS avg_monthly_balance,
  MAX(CASE WHEN d.is_last_day_of_month = 1 THEN f.balance_amount END) AS end_of_month_balance
FROM fact_account_daily f
JOIN dim_date d ON f.date_key = d.date_key
JOIN dim_account a ON f.account_key = a.account_key
GROUP BY d.year, d.month, a.account_type;
```

**非加法的メジャーの設計**

利益率・顧客満足度スコアなどは、構成要素（分子・分母）を加法的ファクトとして保存し、集計後に計算する。

```sql
-- 誤り：利益率をSUM → 意味なし
-- 正解：売上額と費用額を加法的に集計してから計算
SELECT
  SUM(sales_amount) / NULLIF(SUM(cost_amount), 0) AS profit_margin
FROM fact_sales;
```

### 要件7：多値属性（Multi-Valued Dimension）

1つのファクトに対して複数の値を取るディメンション（複数の診断コード、複数のタグ、複数のスキル）はブリッジテーブルで対処する（前述の「多対多」参照）。

**行動タグ時系列（Behavior Tag Time Series）**

顧客の行動を示す多値なタグ（「高頻度購買」「プロモーション反応者」「チャーンリスク」など）を時系列で保持する高度な技法。タグごとにBooleanフラグのカラムとして展開するか、ブリッジテーブルで管理する。

### 要件8：多テナント（マルチテナンシー）

SaaS型分析基盤でテナント分離を行いながらクロステナント分析も必要な場合。

**パターン①：テナントIDを全テーブルに付与**

最もシンプル。全ファクト・ディメンションに `tenant_id` を追加し、RLS（行レベルセキュリティ）でアクセス制御。クロステナント集計も可能。ただしテナント間のカーディナリティ爆発に注意。

**パターン②：スキーマ分離**

テナントごとに別スキーマを持つ。マイグレーションが複雑になるが、物理的分離度が高い。テナント数が数百以内の場合に現実的。

**パターン③：テナントディメンション**

`dim_tenant` を作成し、テナント属性（プラン、業種、地域など）をクロス分析に使う。SaaS事業者が「テナントセグメント別の利用傾向」を分析する場合に有効。

### 要件9：リアルタイム・ニアリアルタイム

バッチ処理前提のOLAPに対してリアルタイム性が求められる場合、**ラムダアーキテクチャ**または**カッパアーキテクチャ**を組み合わせる。

**ラムダアーキテクチャ**：バッチレイヤー（高精度・低遅延）とスピードレイヤー（高鮮度・低精度）の2層を持ち、クエリ時にマージする。

**カッパアーキテクチャ**：Kafkaなどのイベントストリームを唯一の真実源とし、すべての処理をストリーミングで行う。シンプルだが、大規模なバッチ再処理には向かない。

**リアルタイムOLAPエンジン（ClickHouseなど）**：OLAPクエリを数秒以内で返しながら、毎秒数万行の書き込みにも対応する。ディメンショナルモデルをほぼそのまま使えるが、マテリアライズドビューの設計が鍵になる。

### 要件10：高カーディナリティディメンション

ユーザーID・URLなど、数百万〜数億の一意値を持つディメンションはパフォーマンスに深刻な影響を与える。

**対応策①：辞書エンコーディング**

カラムナーストレージが自動的に適用する。文字列を整数IDに変換して圧縮率を大幅に改善。

**対応策②：分解と集約**

高カーディナリティなディメンションを、低カーディナリティな属性への集計テーブルで代替する（ユーザーIDレベルの分析が不要な場合）。

**対応策③：パーティショニングとクラスタリング**

日付やテナントIDでパーティショニングし、よく使うフィルタ条件でクラスタリングすることで、スキャンデータ量を削減する。

**対応策④：デジェネレートディメンション扱い**

個々のユーザーに関する分析が本当に必要な場合、ファクトテーブルにユーザー関連の最小限の属性を直接埋め込む（デジェネレートアプローチ）。

### 要件11：コンプライアンス・監査証跡

規制（SOX、GDPR、MiFID IIなど）に対応するためのデータ追跡設計。

**Data Vaultの活用**：全変更がサテライトの追記で保持されるData Vaultはコンプライアンスに向いている。`record_source`・`load_dts` が自動的に監査情報を提供する。

**監査ディメンション（Audit Dimension）**：Kimballが提唱する、ETLの実行メタデータ（実行ID・パラメータ・ソースファイル名）をディメンションとしてファクトに付与する手法。「このデータはいつのETLで、どのソースから来たか」を追跡できる。

**不変のイベントログ**：ファクトテーブル自体をappend-onlyの不変ログとして設計し、修正はUPDATEではなく新行の追加（補正エントリ）で行う。これは特にリアルタイムOLAPエンジンの設計思想と相性が良い。

---

## 重要人物・文献

- **Ralph Kimball**：『The Data Warehouse Toolkit』（第3版）。ディメンショナルモデリングの聖典。スタースキーマ、SCD、グレイン宣言など実践的手法の体系をまとめた。
- **Bill Inmon**：『Building the Data Warehouse』。EDW中心のアーキテクチャ論を展開したInmonアプローチの創始者。
- **Dan Linstedt**：Data Vault 2.0の発明者。『Building a Scalable Data Warehouse with Data Vault 2.0』。
- **Martin Kleppmann**：『Designing Data-Intensive Applications』。ストリーミング処理とラムダ/カッパアーキテクチャを包括的に解説。
- **Kimball Groupのウェブサイト**：各モデリング技法の公式デザインヒント集を無料公開。数十のデザインTIPが参照できる。

---

## 最新動向・未解決問題

### レイクハウスとOLAPの融合

Apache IcebergやDelta Lakeなどのオープンテーブルフォーマットにより、データレイク上で直接OLAPクエリが実行できる「レイクハウス」が台頭。Kimballスキーマとデータレイクが融合し、「メダリオンアーキテクチャ（Bronze/Silver/Gold層）」がデファクトの階層設計として普及しつつある。

### セマンティックレイヤーの復権

dbt Semantic Layer、Cube.devなど、OLAPエンジンの上に「指標定義」を置くセマンティックレイヤーが再注目されている。物理スキーマに依存しない、ビジネス語彙でのメトリクス定義が可能になり、OBTとスタースキーマの共存を可能にする。

### リアルタイムOLAPのコモディティ化

ClickHouse・Apache Druid・StarRocksなどのリアルタイムOLAPエンジンが成熟し、「バッチDWH前提」のモデリング手法に変化を迫っている。ミリ秒単位のクエリとリアルタイムインジェストを同時に扱える設計が求められるようになっている。

### AIによるモデル生成の試み

LLMを活用してビジネス要件の自然言語記述からエンティティ関係やスタースキーマを自動提案するツールが登場し始めている。ただし、グレイン宣言やSCDタイプの選択は依然として人間の判断が不可欠だ。

---

## 関連トピック

- **OLTP正規化（3NF）との比較**：OLAPの非正規化設計はOLTPとは真逆。両者の境界に立つHTAP（Hybrid Transactional/Analytical Processing）が注目されている
- **グラフデータベース**：再帰階層や複雑な関係の分析にはグラフDBが優位な場合がある
- **時系列データベース**：IoT・監視データなど高頻度時系列データにはInfluxDB・TimescaleDBのような専用DBが有効
- **カラムナーストレージ**：OLAPの高速化を支える物理的基盤。Apache Parquet・ORC・Arrowなどのフォーマット設計

---

## 参考リンク

- [Kimball Dimensional Modeling Techniques](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/)
- [The Three Types of Fact Tables - Holistics](https://www.holistics.io/blog/the-three-types-of-fact-tables/)
- [Modeling Fact Tables in Warehouse - Microsoft Learn](https://learn.microsoft.com/en-us/fabric/data-warehouse/dimensional-modeling-fact-tables)
- [Slowly Changing Dimensions Types and Examples - Luzmo](https://www.luzmo.com/blog/slowly-changing-dimensions)
- [SCD Types Explained with SQL - Medium](https://medium.com/@kazarmax/scd-types-explained-with-sql-a-guide-for-data-engineers-a26a07cf5c60)
- [Design Tip #152 SCD Types 0,4,5,6,7 - Kimball Group](https://www.kimballgroup.com/2013/02/design-tip-152-slowly-changing-dimension-types-0-4-5-6-7/)
- [Multiple Currencies - Kimball Group](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/multiple-currencies/)
- [Data Vault Modeling: Hubs, Links, and Satellites - DEV Community](https://dev.to/alexmercedcoder/data-vault-modeling-hubs-links-and-satellites-1e1h)
- [One Big Table vs Star Schema - Medium](https://medium.com/@hubert.dulay/one-big-table-obt-vs-star-schema-a9f72530d4a3)
- [Bi-Temporal Data Modeling - Medium](https://contact-rajeshvinayagam.medium.com/bi-temporal-data-modeling-an-overview-cbba335d1947)
- [Late Arriving Dimension - Kimball Group](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/late-arriving-dimension/)
- [Semi-Additive Measures in DAX - SQLBI](https://www.sqlbi.com/articles/semi-additive-measures-in-dax/)
- [Materialized Views vs OBT vs Star Schema - Patterns of Data Engineering](https://www.dedp.online/part-2/4-ce/mv-obt-dbt-table-traditional-olap-dwa.html)
- [Bridge Table in Data Warehousing - Techmixing](https://www.techmixing.com/2025/08/what-is-a-bridge-table-in-data-warehousing.html)
