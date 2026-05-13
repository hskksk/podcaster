# pgflow: PostgreSQL上で動くジョブオーケストレーターの詳解

## 概要

pgflowは、Supabaseプロジェクトの中でAIワークフロー、バックグラウンドジョブ、RAGパイプライン、ETLのような複数ステップの処理を動かすための、PostgreSQL中心のワークフローエンジンである。公式サイトは「AI workflows in Supabase, no extra infra」と表現しており、Redis、Temporal、Airflow、外部SaaSのコントロールプレーンを追加せず、Postgres、pgmq、Supabase Edge Functions、Supabase Realtimeといった既存のSupabaseプリミティブを組み合わせて、DAG型の処理を実行する。

一言でいうと、pgflowは「Postgresをワークフローの信頼できる台帳にする」ための道具である。開発者はTypeScript DSLで処理のステップと依存関係を書く。pgflowはその定義をSQL migrationへ変換し、Postgres上の`pgflow`スキーマにフロー定義、実行状態、タスク状態を保存する。実際の処理はEdge Workerがpgmqキューからタスクを読み取り、ハンドラ関数を実行し、結果やエラーをPostgresへ返す。Postgres側の関数は、どのステップの依存関係が満たされたかを判定し、次のタスクをキューへ積む。

pgflowが面白いのは、ただのジョブキューではなく「ジョブ間の依存関係」と「実行状態」をPostgresのトランザクションで扱う点にある。通常、Supabaseで多段のバックグラウンド処理を書く場合、pgmqキューを複数作り、pg_cronでEdge Functionを定期起動し、手作りの状態テーブルに進捗を書き、失敗時のリトライや次段キューへの投入を自分で実装する必要がある。pgflowはこの定型処理をフレームワーク化し、以下をまとめて提供する。

- TypeScriptで書ける型安全なフロー定義
- ステップ間の依存関係に基づく自動実行順序決定
- 同じ依存関係を持つステップの並列実行
- 配列を要素単位で並列処理するmap step
- ステップ単位のリトライ、指数バックオフ、タイムアウト設定
- 失敗時の`fail`、`skip`、`skip-cascade`制御
- Postgresテーブルを直接SQLで観察できる可観測性
- Supabase Realtimeによる進捗イベント購読
- Edge Functionの実行時間制限を前提にしたworker lifecycleと自動再起動

特にAIアプリケーションとの相性がよい。LLM API、埋め込み生成、スクレイピング、外部API呼び出しは失敗やレート制限が起こりやすい。pgflowでは、ワークフロー全体ではなく失敗したステップだけ、map stepなら失敗した配列要素だけをリトライできる。そのため「100件の文書にembeddingを作る途中で3件だけ失敗したので、100件全部ではなく3件だけやり直す」といった設計が自然に書ける。

ただし、pgflowは万能な分散ワークフロー基盤ではない。Postgresを中心にする強みの裏返しとして、非常に長期間動くワークフロー、大規模なスケジューリング、複雑な人間承認フロー、CPU負荷の高い処理、強い隔離が必要なマルチテナント公開APIでは注意が必要である。また、pgflow自身のセキュリティ機能はまだ発展途上であり、クライアントから直接使う場合はRLS、GRANT、入力中の`user_id`設計などを利用者側で設計する必要がある。

本レポートでは、pgflowの使い方、仕組み、アーキテクチャ、得意なこと、苦手なこと、運用で詰まりやすい点、そして「こういう時にはこうする」という逆引き辞典をまとめる。

## 背景・歴史

### Supabaseで多段ジョブを書く時の典型的なつらさ

SupabaseはPostgresを中心に、Auth、Storage、Realtime、Edge Functions、pg_cron、pgmqなどを提供する。これらを組み合わせれば、外部のRedisやワーカー基盤を使わなくても非同期ジョブを動かせる。例えば、Webページをスクレイピングし、要約し、キーワード抽出し、最後に記事を公開する処理は次のように設計できる。

1. `scrape_queue`にURLを入れる
2. Edge Functionが`pgmq.read()`でURLを読む
3. スクレイピング結果を`articles`テーブルへ保存する
4. `summarize_queue`と`extract_keywords_queue`へメッセージを送る
5. 別々のEdge Functionが要約とキーワード抽出を行う
6. 両方が終わったことを状態テーブルで確認して公開する
7. 各Edge Functionをpg_cronで定期的に叩く
8. 失敗時はvisibility timeoutや再投入を考える

これは動くが、処理が増えるほど手作りの配線が増える。キューを作るSQL、メッセージを読むコード、状態テーブルへの書き込み、次段キュー投入、失敗時の再試行、途中状態の可視化、重複実行時の対策を毎回書くことになる。pgflowのREADMEは、こうした手作業を約240行のboilerplateとして示し、それをTypeScript DSLの数十行に置き換えることを主張している。

### pgmqの上にある「ワークフロー層」

pgflowの土台にはpgmqがある。pgmqはPostgres上で動く軽量メッセージキュー拡張で、AWS SQSに近いAPIを持つ。`pgmq.send()`でJSONメッセージを送り、`pgmq.read(queue, vt, qty)`で読み、処理に成功したら`pgmq.delete()`または`archive()`する。`vt`はvisibility timeoutであり、読まれたメッセージが他のconsumerから見えなくなる時間を意味する。処理が成功しなければ、timeout後に再び見えるようになる。

pgmqだけでもジョブキューとしては便利だが、「ステップAが終わったらBとCを並列に開始し、BとCが両方終わったらDを開始する」という依存関係の表現は提供しない。pgflowはこの部分をPostgres関数とテーブルで実装する。pgmqはタスク配送、pgflowはDAGの状態遷移、Edge Workerは実行という分担である。

### 開発状況

pgflowはApache 2.0ライセンスのオープンソースプロジェクトで、GitHub上では`pgflow-dev/pgflow`として公開されている。2026年3月20日時点の最新リリースとしてv0.14.1が案内されており、JSON互換のstep outputを`.step()`構築時に強制するなど、型安全性と依存関係更新が含まれている。2026年1月には、workerが処理中に停止した時にtaskが`started`状態で詰まる問題に対して、stalled task recoveryがv0.13.2で導入された。つまり、実運用からのフィードバックを受けながら改善が進んでいる段階のプロジェクトである。

## 核となる概念

### Flow

Flowはワークフロー全体の定義である。slugで識別され、DAGのルートになる。TypeScriptでは次のように作る。

```typescript
import { Flow } from '@pgflow/dsl';

export const AnalyzeArticle = new Flow<{ url: string }>({
  slug: 'analyzeArticle',
  maxAttempts: 3,
  baseDelay: 2,
  timeout: 120,
});
```

Flowにはデフォルトのリトライ回数、指数バックオフの初期遅延、visibility timeoutなどを設定できる。これらは各stepで上書きできる。

### Step

StepはDAGのノードであり、1つの論理的な処理単位である。`.step()`で定義する。依存関係を持たないroot stepはflow inputを受け取り、依存関係を持つstepは依存stepの出力を受け取る。

```typescript
new Flow<{ url: string }>({ slug: 'processArticle' })
  .step({ slug: 'fetchArticle' }, async (input) => {
    const res = await fetch(input.url);
    return await res.text();
  })
  .step({ slug: 'summarize', dependsOn: ['fetchArticle'] }, async (deps) => {
    return await summarize(deps.fetchArticle);
  });
```

`dependsOn`があることで、pgflowは実行順序を決定する。複数のstepが同じ依存関係を持っていれば並列に実行できる。

### Array step

`.array()`は配列を返すことを意味的に表すstepである。SQL Core上では通常のsingle stepと同じ種類のタスクを作るが、後続のmap stepに配列を渡す前段として使いやすい。

```typescript
.array({ slug: 'chunks', dependsOn: ['fetchArticle'] }, async (deps) => {
  return splitIntoChunks(deps.fetchArticle);
})
```

### Map step

Map stepは配列の各要素を独立タスクとして並列処理するためのstepである。1つのstepだが、内部では配列長Nに対してN個のtaskを作る。各taskは自分のretry counterを持ち、失敗した要素だけをリトライする。

```typescript
.map({ slug: 'embeddings', array: 'chunks' }, async (chunk) => {
  return await createEmbedding(chunk);
})
```

Map stepには2種類ある。

- Root map: flow input自体が配列であり、`array`を指定しない
- Dependent map: 別stepの配列出力を処理し、`array: 'stepSlug'`を指定する

Map stepの重要な制約は、`dependsOn`を直接持てないことである。map handlerは個別要素だけを受け取る。追加の設定値や別stepの出力が必要な場合は、前段のarray stepで各要素に必要データを埋め込んでからmapする。

### Run

RunはFlowの1回の実行インスタンスである。`pgflow.start_flow()`を呼ぶと、`pgflow.runs`にrunが作られる。runは`started`、`completed`、`failed`などのstatusを持ち、入力、出力、残りstep数を保持する。

```sql
SELECT * FROM pgflow.start_flow(
  flow_slug => 'processArticle',
  input => '{"url": "https://example.com"}'::jsonb
);
```

### Task

Taskはworkerが実際に実行する単位である。single stepは通常1つのtaskを作る。map stepは配列要素ごとにtaskを作る。taskは`pgflow.step_tasks`に保存され、queue message ID、attempt count、worker ID、開始時刻、失敗メッセージなどを持つ。

### Worker

WorkerはEdge Functionとして動くstatelessな実行プロセスである。`EdgeWorker.start(MyFlow)`のように起動し、pgmqキューからタスクを読み、対応するstep handlerを呼び出す。成功したら`complete_task()`、失敗したら`fail_task()`相当の処理でPostgresへ結果を返す。

```typescript
import { EdgeWorker } from 'jsr:@pgflow/edge-worker';
import { AnalyzeArticle } from './analyze_article.ts';

EdgeWorker.start(AnalyzeArticle);
```

### Flow shape

Flow shapeとは、step slug、step順序、依存関係、step typeのような、DAG構造を決める情報である。handlerの中身を変更してもshapeは変わらないが、stepを追加、削除、リネームしたり、依存関係を変えたりするとshapeが変わる。

本番では既存flowのshape mismatchがあるとworkerは起動を拒否する。これは実行中のrunを壊さないためである。構造変更をしたい場合は、`processOrderV2`のような新しいslugでバージョンを作る。

## 詳細な仕組み・アーキテクチャ

### 3層アーキテクチャ

pgflowの設計資料は、全体を3層に分けて説明している。

| 層 | 役割 | 置き場所 |
| --- | --- | --- |
| DSL layer | ユーザーがTypeScriptでflow意図を表現する | アプリのリポジトリ |
| SQL Core layer | 依存関係解決、状態遷移、task生成、結果集約を行う | Postgres関数・テーブル |
| Worker layer | handlerを実行し、成功・失敗をSQL Coreへ返す | Edge Functionなどのランタイム |

この分離がpgflowの中心思想である。DSLは「この配列を要素単位で並列処理したい」という開発者の意図を扱う。SQL Coreは「依存関係が満たされたstepを開始し、必要なtaskを作り、終わったら次を開始する」という状態機械を扱う。Workerは「このpayloadでこの関数を実行して結果を返す」ことだけを扱う。

### Build-timeとRun-time

pgflowでは、flow定義はBuild-timeとRun-timeに分かれる。

Build-timeではTypeScript DSLでflowを書く。`npx pgflow compile`またはworker起動時のstartup compilationにより、そのflowはSQL migrationへ変換される。migrationには`pgflow.create_flow(...)`や`pgflow.add_step(...)`が含まれ、Postgres上のdefinition tablesへ登録される。

Run-timeでは、`pgflow.start_flow()`でrunが作られる。SQL Coreはrunに対応するstep stateとtaskを作り、readyになったtaskをpgmqへ送る。workerはキューをpollし、handlerを実行し、結果を返す。Postgresはその結果を受けて次のstepを開始するか、runをcompleteまたはfailにするかを決める。

### データモデル

pgflowのテーブルは大きく2種類に分かれる。

#### Definition tables

- `pgflow.flows`: flowのslugと全体設定
- `pgflow.steps`: step定義、step type、stepごとの設定
- `pgflow.deps`: step間の依存関係

これらはワークフローの設計図であり、通常はデプロイ時に更新される。

#### Runtime state tables

- `pgflow.runs`: flow実行インスタンス
- `pgflow.step_states`: run内の各stepの状態
- `pgflow.step_tasks`: workerが実行するtask単位の状態
- `pgflow.workers`: worker instanceのheartbeatや停止状態

runtime tablesは実行ごとに更新される。`runs.remaining_steps`はrun完了判定に使われ、`step_states.remaining_tasks`はmap stepの残りtask数を追跡する。map stepでは`task_index`が配列中の位置を表し、結果集約時には完了順ではなく`task_index`順に配列が再構成される。

このデータモデルの利点は、ほとんどの状態がSQLで直接観察できる点である。専用ダッシュボードがなくても、`pgflow.runs`、`pgflow.step_states`、`pgflow.step_tasks`を見れば、どのrunのどのstepが詰まっているか分かる。

### 実行状態の流れ

典型的な実行は次のように進む。

1. アプリ、SQL、pg_cron、DB triggerなどが`pgflow.start_flow()`を呼ぶ
2. `pgflow.runs`にrunが作られる
3. 各stepに対して`step_states`が作られる
4. 依存関係がないroot step、または依存関係が満たされたstepがreadyになる
5. SQL Coreがtaskを作成し、pgmqキューへmessageを送る
6. workerがmessageを読んでtaskを`started`にする
7. workerがhandlerを実行する
8. 成功ならoutputを保存し、stepまたはtaskを`completed`にする
9. SQL Coreが後続stepのremaining dependenciesを減らす
10. 新たにreadyになったstepのtaskをenqueueする
11. 全leaf stepが完了するとrun outputが集約され、runが`completed`になる

失敗した場合は、attempt countと設定に基づいて再試行される。max attemptsを使い切ると、`whenExhausted`に従ってrunをfailするか、stepをskipするか、downstreamをskip-cascadeする。

### Two-phase polling

pgflowはworkerとSQL Coreの間でtwo-phase pollingを使う。これは、メッセージを読んだworkerがtask状態と同期しないまま処理を始めるrace conditionを避けるためである。

概念的には次の2段階である。

1. `read_with_poll()`でpgmq messageをreserveする
2. `start_tasks(worker_id)`で対応する`step_tasks`をatomicに`started`へ移し、workerへtask詳細を返す

この仕組みにより、workerが受け取ったmessageとPostgres側のtask状態が紐づく。過去にはworker停止時にtaskが`started`のまま詰まり、messageだけがvisibility timeout後に何度も再配信される問題が報告された。v0.13.2以降では、stalled task recoveryとして、一定時間`started`のままのtaskをcronで再queueする仕組みが導入されている。

### Worker lifecycle

Supabase Edge Functionsには実行時間制限がある。公式ドキュメントでは、Free tierで150秒、Paid tierで400秒と説明されている。pgflow workerはこの前提で設計されており、常駐プロセスのように見えても、実際には停止と再起動を繰り返す。

worker lifecycleは次のような流れである。

1. workerが起動し、DBに自分を登録する
2. 6秒ごとにheartbeatを送る
3. taskをpollし、`maxConcurrent`まで並列実行する
4. shutdown signalを受けたらgraceful shutdownへ移行する
5. cronがheartbeatのないworkerを検知して新しいEdge Function instanceを起動する

ローカルではcronが頻繁にEdge Functionを叩き、コード変更時に自動再起動とstartup compilationが走る。本番では、active workerが不足している場合に自動起動する。

### Startup compilation

Startup compilationは、worker起動時にflow定義をPostgresへ自動登録・検証する仕組みである。workerは起動時にflow slugをDBで探す。存在しなければcompileして登録する。存在すればTypeScript定義とDB上のshapeを比較する。

ローカル開発では、shapeが変わっていた場合に既存flowとrun dataを削除して再compileできる。これにより、開発者はstepを追加・削除しながら素早く試せる。一方、本番ではshape mismatchは`FlowShapeMismatchError`としてworker起動失敗になる。既存runを壊さないための安全装置である。

本番で構造変更する場合は、既存slugを変更せず、新しいversioned slugを作る。例えば`invoicePipeline`を変更するなら`invoicePipelineV2`を作り、古いrunは旧flowで完走させる。

### Retryとtimeout

pgflowのstep execution optionsには次がある。

- `maxAttempts`: 最大試行回数。デフォルト3
- `baseDelay`: retryの初期遅延秒。デフォルト1
- `timeout`: visibility timeout秒。デフォルト60
- `startDelay`: task開始前の初期遅延。step levelのみ

リトライ遅延は指数バックオフで、概念的には次の式になる。

```text
delay = baseDelay * 2^attemptCount
```

注意点は、`timeout`が「handlerを強制停止する実行時間制限」ではなく、基本的にはmessageのvisibility timeoutであることだ。処理がtimeoutより長く走ると、messageが再びvisibleになり、別workerが同じtaskを拾う可能性がある。したがって、timeoutは「通常の最大処理時間より十分長く」設定する必要がある。handler側ではidempotencyを意識し、外部APIへの書き込みやDB insertには重複実行に耐える設計を入れるべきである。

### Conditional steps

pgflowは`if`、`ifNot`、`whenUnmet`、`whenExhausted`で条件実行や失敗時の扱いを制御できる。

`if`と`ifNot`はPostgreSQLのJSONB containment operator `@>`に近いパターンで入力や依存出力を照合する。条件が満たされない時の動作は`whenUnmet`で決める。デフォルトは`skip`である。

`whenExhausted`はretryを使い切った後の動作で、デフォルトは`fail`である。

3つのmodeは共通している。

| mode | 意味 |
| --- | --- |
| `fail` | step失敗、run全体も失敗 |
| `skip` | stepをskippedにし、runは継続。dependentには`undefined`が渡る |
| `skip-cascade` | stepと下流dependentをまとめてskippedにし、runは継続 |

メール送信や通知のようなoptional stepは`whenExhausted: 'skip'`が合う。一方、支払い確定やデータ整合性に関わるcritical stepは`fail`のままにするのがよい。

## 具体例・応用事例

### 基本: 記事分析フロー

```typescript
import { Flow } from '@pgflow/dsl/supabase';

export const AnalyzeArticle = new Flow<{ url: string }>({
  slug: 'analyzeArticle',
  maxAttempts: 3,
  baseDelay: 2,
  timeout: 180,
})
  .step({ slug: 'fetchArticle' }, async (input) => {
    const res = await fetch(input.url);
    return await res.text();
  })
  .step({ slug: 'summarize', dependsOn: ['fetchArticle'] }, async (deps) => {
    return await summarizeWithLLM(deps.fetchArticle);
  })
  .step({ slug: 'extractKeywords', dependsOn: ['fetchArticle'] }, async (deps) => {
    return await extractKeywords(deps.fetchArticle);
  })
  .step(
    { slug: 'publish', dependsOn: ['summarize', 'extractKeywords'] },
    async (deps, ctx) => {
      const input = await ctx.flowInput;
      await ctx.supabase.from('articles').insert({
        url: input.url,
        summary: deps.summarize,
        keywords: deps.extractKeywords,
      });
      return { ok: true };
    }
  );
```

このフローでは、`fetchArticle`が終わると`summarize`と`extractKeywords`が並列に走る。両方が終わると`publish`が走る。LLM APIが一時的に失敗した場合、失敗したstepだけがretryされる。

### RAGパイプライン

RAG用途では、文書取得、分割、embedding生成、vector indexへの保存という流れが典型的である。pgflowではmap stepが効く。

```typescript
new Flow<{ documentId: string }>({ slug: 'indexDocument' })
  .step({ slug: 'loadDocument' }, loadDocument)
  .array({ slug: 'chunks', dependsOn: ['loadDocument'] }, async (deps) => {
    return chunkText(deps.loadDocument.text);
  })
  .map({ slug: 'embeddings', array: 'chunks' }, async (chunk) => {
    return await createEmbedding(chunk);
  })
  .step({ slug: 'saveIndex', dependsOn: ['embeddings'] }, async (deps, ctx) => {
    await ctx.supabase.from('document_embeddings').insert(deps.embeddings);
    return { count: deps.embeddings.length };
  });
```

100個のchunkのうち1個だけembedding APIで失敗しても、その1個だけをretryできる。これはAI workloadsで大きな利点である。

### Optionalな通知

```typescript
.step(
  {
    slug: 'sendWelcomeEmail',
    dependsOn: ['createAccount'],
    maxAttempts: 3,
    whenExhausted: 'skip',
  },
  async (deps) => {
    await sendEmail(deps.createAccount.email);
    return { sent: true };
  }
)
```

メールサービス障害でユーザー作成run全体を失敗させたくない場合、`whenExhausted: 'skip'`にする。ただし、dependent stepは`undefined`を受ける可能性があるため、TypeScript上でもその扱いが必要になる。

### SQLから起動する

pgflowはSQL functionとしてflowを起動できるため、DB trigger、pg_cron、アプリからのRPCなど、入口を柔軟に選べる。

```sql
SELECT * FROM pgflow.start_flow(
  flow_slug => 'indexDocument',
  input => '{"documentId": "doc_123"}'::jsonb
);
```

定期バッチならpg_cronから起動できる。アプリからユーザー操作で始めるならSupabase RPCまたは`@pgflow/client`を使える。ただしブラウザから直接pgflow schemaへアクセスさせる場合はセキュリティ設計が必須である。

### 監視SQL

直近のrunを見る。

```sql
SELECT *
FROM pgflow.runs
WHERE flow_slug = 'indexDocument'
ORDER BY started_at DESC
LIMIT 10;
```

特定runのstep状態を見る。

```sql
SELECT step_slug, status, remaining_deps, remaining_tasks, output
FROM pgflow.step_states
WHERE run_id = 'your-run-id';
```

active taskを見る。

```sql
SELECT run_id, step_slug, status, attempts_count, message_id, queued_at, started_at
FROM pgflow.step_tasks
WHERE status IN ('queued', 'started')
ORDER BY queued_at ASC;
```

失敗stepの詳細を見る。

```sql
SELECT ss.step_slug, st.attempts_count, st.error_message, st.queued_at, st.failed_at
FROM pgflow.step_states ss
JOIN pgflow.step_tasks st
  ON ss.run_id = st.run_id
 AND ss.step_slug = st.step_slug
WHERE ss.run_id = 'your-run-id'
  AND ss.status = 'failed';
```

## いいところ

### 1. 追加インフラなしで始められる

pgflowの最大の魅力は、Supabaseをすでに使っているなら追加のキューサーバー、Redis、Temporal cluster、Airflow schedulerを立てなくてよい点である。状態もキューもPostgresにあり、workerはEdge Functionsとして動く。

### 2. 状態がPostgresに残る

ワークフロー状態が外部サービスの中に隠れない。`pgflow.runs`、`step_states`、`step_tasks`をSQLで見ればよい。運用者にとって、これは大きな安心感がある。既存のDB監視、SQLダッシュボード、BI、ログ調査とつなぎやすい。

### 3. TypeScript DSLの型推論が便利

依存stepの出力が後続stepに型付きで渡る。skip可能なstepは`undefined`の可能性も型に反映される。DAGを文字列とJSONだけで手作りするより、編集時の補完と型チェックが効きやすい。

### 4. AIパイプライン向きのretry粒度

LLM、embedding、スクレイピング、外部APIなど失敗しやすい処理をstep単位、map task単位でretryできる。全体を最初からやり直すよりコストが低い。

### 5. Supabase Realtimeと相性がよい

SQL Coreは`run:started`、`run:completed`、`run:failed`、`step:started`、`step:completed`、`step:failed`のようなイベントをRealtimeへ流す。`@pgflow/client`を使えば、アプリ側で進捗を購読し、UIに表示できる。

### 6. serverless workerを前提にしている

Edge Functionsは永続workerではない。pgflowはheartbeat、自動再起動、stalled task recoveryのように、serverless環境の停止を前提にした仕組みを持つ。

## 苦手なこと・注意点

### 1. 超長時間実行には向かない

Supabase Edge Functionsには実行時間制限がある。1つのhandlerが数十分から数時間走る設計はpgflowの中心的ユースケースではない。長い処理は小さなstepやmap taskへ分割するべきである。どうしても長時間のdurable executionが必要ならTemporalのような基盤を検討する。

### 2. Timeoutは強制停止ではない

`timeout`はvisibility timeoutとして扱われる。handlerを自動でkillする保証ではない。timeoutが短すぎると同じmessageが再配信され、重複実行のリスクがある。外部APIやDB書き込みはidempotentに設計する。

### 3. セキュリティは利用者側の責任

pgflowはMVP段階として、ビルトインのRLSやユーザー帰属管理を提供していない。インストール直後はpermissionが付与されていないため安全寄りだが、`@pgflow/client`をブラウザから使うために`pgflow` schemaをPostgRESTへ露出し、authenticatedに広い権限をgrantすると、全authenticated userが任意flowを起動したりrunを閲覧したりできる恐れがある。

安全に使うには、flow inputに`user_id`を入れ、`pgflow.runs`などにRLSを設定し、`input->>'user_id' = auth.uid()`のようなpolicyを作る必要がある。必要なら専用RPCで入力検証と権限チェックを行い、pgflow schemaを直接公開しない設計も検討する。

### 4. Flow structureは本番でimmutable

本番で既存flowのstep追加、削除、依存関係変更、slug変更を直接行うべきではない。既存runや状態テーブルとの整合性を壊すためである。構造変更はversioned flow slugで行う。

### 5. Postgresがボトルネックになりうる

状態管理、キュー、オーケストレーションがすべてPostgresに集まるため、巨大なthroughputや大量の高頻度taskではDB負荷に注意が必要である。`maxConcurrent`、`maxPgConnections`、map stepの配列サイズ、queue metrics、DB connection poolを観察しながら調整する。

### 6. 複雑な人間系ワークフローには不足する可能性

承認待ち、数週間の待機、外部イベント待ち、補償トランザクション、バージョンをまたぐ長寿命ビジネスプロセスなどは、Temporalや専用workflow SaaSのほうが向く場面がある。pgflowは「Supabase内で動く実用的なDAG job orchestration」と捉えるのがよい。

## 逆引き辞典: こういう時にはこうする

### Q1. Supabaseで複数のEdge Functionとpgmqを手作業でつなぐのがつらい

pgflowを使う。TypeScript DSLでstepと`dependsOn`を書く。キュー作成、状態管理、次段投入、retryを手作業で書かずに済む。

### Q2. Aが終わったらBとCを並列に走らせたい

BとCの`dependsOn`を同じAにする。

```typescript
.step({ slug: 'b', dependsOn: ['a'] }, runB)
.step({ slug: 'c', dependsOn: ['a'] }, runC)
```

pgflowがA完了後にBとCをreadyにする。

### Q3. BとCが両方終わったらDを走らせたい

Dの`dependsOn`にBとCを両方指定する。

```typescript
.step({ slug: 'd', dependsOn: ['b', 'c'] }, runD)
```

### Q4. 配列100件を並列処理し、失敗した要素だけretryしたい

`.map()`を使う。前段で配列を返すなら`.array()`を使い、その出力をmapする。

```typescript
.array({ slug: 'items' }, loadItems)
.map({ slug: 'processed', array: 'items' }, processOne)
```

### Q5. map handlerで別stepの設定値も使いたい

map stepは`dependsOn`を持てない。前段のarray stepで要素に必要なデータを合成する。

```typescript
.array({ slug: 'enrichedItems', dependsOn: ['items', 'config'] }, (deps) =>
  deps.items.map((item) => ({ item, apiKey: deps.config.apiKey }))
)
.map({ slug: 'processed', array: 'enrichedItems' }, processEnriched)
```

### Q6. 空配列の時に下流が詰まらないようにしたい

pgflowのmap stepは空配列を受け取るとtaskを作らず即座に`[]`でcompleteする。下流のmap stepにも空配列がcascadeする。特別なhandlerは不要だが、空配列が正しい業務結果かは前段で確認する。

### Q7. Optionalなstepが失敗してもrunを続けたい

`whenExhausted: 'skip'`を使う。

```typescript
.step({ slug: 'notify', whenExhausted: 'skip' }, notify)
```

後続stepでは`deps.notify`が`undefined`になり得る。

### Q8. Optional stepの下流もまとめて飛ばしたい

`whenExhausted: 'skip-cascade'`、または条件不一致なら`whenUnmet: 'skip-cascade'`を使う。optionalな枝全体を落としたい時に向く。

### Q9. 条件に合うユーザーだけstepを実行したい

`if`または`ifNot`を使う。

```typescript
.step({
  slug: 'premiumFeature',
  if: { plan: 'premium' },
  whenUnmet: 'skip',
}, runPremium)
```

### Q10. LLM APIのrate limitに強くしたい

LLM API呼び出しstepだけ`maxAttempts`と`baseDelay`を大きくする。

```typescript
.step({
  slug: 'callLLM',
  maxAttempts: 6,
  baseDelay: 10,
  timeout: 180,
}, callLLM)
```

rate limitが長引く場合は`baseDelay`を伸ばし、map stepの並列度も抑える。

### Q11. 処理が二重実行されるのが怖い

まず`timeout`を最大処理時間より長くする。次にhandlerをidempotentにする。DB insertにはunique keyとupsertを使い、外部API呼び出しにはidempotency keyがあれば使う。特に支払い、メール、外部書き込みは「同じrun_idとstep_slugで再実行されても副作用が重複しない」設計にする。

### Q12. workerが途中で死んでtaskが`started`で止まった

v0.13.2以降のstalled task recoveryが有効か確認する。公式の復旧cronは15秒ごとに、step timeout + 30秒を超えて`started`のtaskをrequeueし、3回を超えるとmessageをarchiveして`permanently_stalled_at`を記録する。

確認SQL:

```sql
SELECT r.flow_slug, st.step_slug, st.run_id, st.status,
       st.started_at, st.requeued_count, now() - st.started_at AS stuck_duration
FROM pgflow.step_tasks st
JOIN pgflow.runs r ON r.run_id = st.run_id
WHERE st.status = 'started'
  AND st.started_at < now() - interval '5 minutes'
ORDER BY st.started_at;
```

### Q13. 本番でstepを追加したい

既存flow slugを変更しない。`myFlowV2`のような新しいflowを作り、compileしてmigrationを適用する。既存runは旧flowで完走させる。

### Q14. Handlerのロジックだけ直したい

step slug、依存関係、step type、input/output構造が変わらないなら、同じflowのhandlerコードを更新してよい。これはsafe changeであり、新versionは不要なことが多い。

### Q15. Retry回数やtimeoutだけ本番で調整したい

flow/stepの構造変更ではないため、DB上のoptionをupdateできる。

```sql
UPDATE pgflow.steps
SET opt_max_attempts = 5,
    opt_timeout = 120
WHERE flow_slug = 'analyzeWebsite'
  AND step_slug = 'website';
```

### Q16. クライアントから進捗をリアルタイム表示したい

`@pgflow/client`とSupabase Realtimeを使う。ただし、pgflow schemaを公開する場合はRLSとGRANTを設計する。公開せずにサーバー側APIから状態を中継する案もある。

### Q17. ユーザーごとにrunの閲覧を制限したい

flow inputに`user_id`を含める。`pgflow.runs`にRLSを有効化し、`input->>'user_id'`と`auth.uid()`を比較するpolicyを作る。性能のために式indexも作る。

```sql
ALTER TABLE pgflow.runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_runs_user_id ON pgflow.runs ((input->>'user_id'));

CREATE POLICY "Users see own runs" ON pgflow.runs
  FOR SELECT USING ((SELECT auth.uid())::text = input->>'user_id');
```

### Q18. 単純な1ステップのbackground jobだけ欲しい

pgflow workflowsではなく、Edge Workerのbackground jobs modeを使う選択肢がある。

```typescript
import { EdgeWorker } from 'jsr:@pgflow/edge-worker';

EdgeWorker.start(async (payload: { url: string }) => {
  const response = await fetch(payload.url);
  console.log(response.status);
});
```

複数stepの依存関係が不要なら、このほうが単純である。

### Q19. CPU heavyな処理を大量に回したい

Edge FunctionsとPostgres中心のキューはI/O heavyな処理に向きやすい。CPU heavyなら`maxConcurrent`を下げる、外部workerランタイムを検討する、処理を小さく分割する。Postgres接続数とDB負荷も監視する。

### Q20. Temporal、Airflow、pg-boss、Graphile Workerと迷う

- Supabase内でAI/バックグラウンドDAGを動かし、追加インフラを避けたい: pgflow
- 数週間から数か月続くdurable application workflow、補償処理、複雑な状態遷移: Temporal
- cron中心のデータパイプライン、DAGスケジューリング、データ基盤運用: Airflow
- Postgresベースの単純なジョブキューをNode.jsで使いたい: pg-bossやGraphile Worker
- ブラウザ連携やSupabase Realtime込みで進捗を見たい: pgflowが候補

## 重要人物・文献

pgflowの公式サイトは、Supabase CEO Paul Copplestoneによる「A workflow engine built on Supabase primitives」というコメントを引用している。これはpgflowの位置づけをよく表している。pgflowはSupabaseそのものではないが、SupabaseのPostgres、Edge Functions、Realtime、pgmqというプリミティブを組み合わせ、足りないworkflow orchestration層を補う。

技術的な一次資料として重要なのは、公式ドキュメント、GitHub README、Architecture Guide、Security Guide、PGMQ docsである。特にArchitecture Guideは、DSL、SQL Core、Edge Workerの責務分離、two-phase polling、empty array cascade、Realtime events、map stepの実装モデルを詳しく説明している。

## 最新動向・未解決問題

### v0.14.1時点の改善

2026年3月のv0.14.1では、step outputのJSON互換性を`.step()`構築時に強制する改善が入った。pgflowはPostgresにJSONBとして入出力を保存するため、JSON serializableであることは重要な不変条件である。

### Stalled task recovery

2026年1月には、workerが処理中に停止した時にtaskが`started`状態に残り、messageがqueue内で高い`read_ct`を持って循環し続ける問題が報告された。これはserverless workerでは現実的な障害である。pgflow側ではcronによるstalled task recoveryが導入され、一定時間を超えた`started` taskをrequeueし、複数回失敗したものをpermanently stalledとして記録するようになった。

### 今後も注意すべき点

pgflowは活発に進化している一方、セキュリティ、長時間実行、worker停止時の境界条件、flow更新手順、timeoutの意味などは、利用者が理解したうえで設計する必要がある。特にプロダクションでは、公式ドキュメントのバージョニング方針、stalled task復旧、RLS設計、timeout tuningを事前に確認すべきである。

## 関連トピック

### PGMQ

pgflowの下層にあるPostgres message queue。`send`、`read`、`read_with_poll`、`delete`、`archive`、`metrics`などを提供する。visibility timeoutを中心にした配送モデルを理解しておくと、pgflowのtimeoutや重複実行リスクも理解しやすい。

### pg_cron

Supabase上で定期実行を行うためのPostgres extension。pgflowのworker auto-restartや定期flow起動と組み合わせる。

### Supabase Edge Functions

pgflow workerが動くserverless runtime。実行時間制限、環境変数、service role key、Deno runtime、HTTP起動モデルを理解する必要がある。

### Supabase Realtime

runやstepの状態変化をクライアントへ通知するために使われる。UIで進捗を出す場合に重要。

### Temporal

durable executionに強い外部workflow engine。長期間・複雑な業務ワークフローなら候補になる。

### Airflow

データパイプラインやcronスケジュール中心のDAG orchestrationで使われる。pgflowより運用基盤は重いが、データエンジニアリング領域では成熟している。

### pg-boss / Graphile Worker

Postgresを使うジョブキュー。pgflowよりworkflow orchestrationは薄いが、単純なジョブ処理には適している場面がある。

## まとめ

pgflowは「Supabase上で多段ジョブを作る時に、毎回pgmq、pg_cron、状態テーブル、Edge Function配線を手で書きたくない」という問題への実践的な答えである。Postgresをsingle source of truthにし、TypeScript DSLでDAGを定義し、SQL Coreが依存関係と状態遷移を管理し、Edge Workerがstatelessにtaskを実行する。

向いているのは、AI pipelines、RAG indexing、外部API連携、スクレイピング、メールや通知、ファイル処理、複数stepのバックグラウンド処理である。特にmap stepによる配列要素単位の並列処理と独立retryは、LLM/embedding系のコストと失敗率を抑えるうえで有効である。

一方で、timeoutの意味、idempotency、RLS、flow versioning、Edge Functionの実行時間制限、Postgres負荷は設計上の注意点である。pgflowは「Postgresだけで何でもやる魔法」ではなく、「Postgresを中心にした透明なworkflow orchestrationを、Supabaseの範囲で現実的に実装する道具」と理解するとよい。

導入判断の目安は次のようにまとめられる。

- Supabaseを使っていて、複数stepのジョブを追加インフラなしで動かしたいなら強い候補
- 各stepの状態をSQLで見たいなら相性がよい
- LLMや外部APIの失敗をstep単位でretryしたいなら便利
- 数か月続くdurable workflowや複雑な人間系プロセスならTemporalなどを比較する
- 単純な1ステップqueueならEdge Worker background jobs modeや既存Postgres job queueでもよい
- クライアント公開するならRLSとGRANTを必ず設計する

pgflowは、Supabaseアプリに「ワークフローエンジンのちょうど足りない層」を足すプロジェクトである。Postgres中心の開発思想に共感でき、DAG型の非同期処理を増やしていきたいチームにとって、調査・検証する価値は大きい。

## 参考リンク

- pgflow公式サイト: https://pgflow.dev/
- How pgflow Works: https://www.pgflow.dev/concepts/how-pgflow-works/
- Three-layer architecture: https://www.pgflow.dev/concepts/three-layer-architecture/
- Data Model: https://www.pgflow.dev/concepts/data-model/
- Map Steps: https://www.pgflow.dev/concepts/map-steps/
- Startup Compilation: https://www.pgflow.dev/concepts/startup-compilation/
- Worker Lifecycle: https://www.pgflow.dev/concepts/worker-lifecycle/
- Install pgflow: https://www.pgflow.dev/get-started/installation/
- Quickstart: https://www.pgflow.dev/get-started/flows/quickstart/
- Step Execution Options: https://www.pgflow.dev/reference/configuration/step-execution/
- Queue Worker Configuration: https://www.pgflow.dev/reference/queue-worker/configuration/
- Conditional Steps: https://www.pgflow.dev/build/conditional-steps/
- Version flows: https://www.pgflow.dev/build/version-flows/
- Tune Deployed Flows: https://www.pgflow.dev/deploy/tune-flow-config/
- Monitor flow execution: https://www.pgflow.dev/deploy/monitor-execution/
- Troubleshooting Stalled Tasks: https://www.pgflow.dev/deploy/troubleshooting-stalled-tasks/
- Background Jobs Mode: https://www.pgflow.dev/get-started/background-jobs/create-worker/
- pgflow GitHub README: https://raw.githubusercontent.com/pgflow-dev/pgflow/main/README.md
- pgflow Architecture Guide: https://raw.githubusercontent.com/pgflow-dev/pgflow/main/ARCHITECTURE_GUIDE.md
- pgflow Security Guide: https://raw.githubusercontent.com/pgflow-dev/pgflow/main/pkgs/client/SECURITY.md
- PGMQ Extension docs: https://supabase.com/docs/guides/queues/pgmq
- Stalled task issue #586: https://github.com/pgflow-dev/pgflow/issues/586
