# GCP IaC — `audio-transcode` Cloud Run Job

Terraform で Artifact Registry・Cloud Run Job・Supabase 用 invoker SA を定義する。

| 正本 | 置き場 |
|------|--------|
| **Terraform 変数** | [Terraform Cloud](./TFC.md) の variable set `podcaster-audio-transcode` |
| **state（tfstate）** | 同上（ローカルに state を置かない） |
| **Edge / Cloud Build** | ルート **`.env`** の `GCP_*`（TFC の `project_id` と同値） |

設計: [audio-transcode-cloud-run.md](../../../docs/architecture/audio-transcode-cloud-run.md)

## 前提

- リポジトリルートで `mise install`（`terraform` / `gcloud` — [`.mise.toml`](../../../.mise.toml)）
- Terraform Cloud: CLI-driven workspace **`podcaster-audio-transcode`**（手順 [TFC.md](./TFC.md)）。Organization 既定 `hskksk`（違えば `versions.tf` を変更）
- `terraform login`
- **Execution mode = Remote**（state も plan/apply も TFC。手元の GCP ADC は不要）
- GCP プロジェクトで Billing 有効

## 1. 初回セットアップ

### 1.1 Terraform Cloud

[TFC.md § Workspace](./TFC.md#workspace-の作り方) どおり workspace を 1 つ作成し、**[Variable set](./TFC.md#variable-set必須セットアップ)** に `project_id` と SA JSON を登録する。

### 1.2 ルート `.env`（Edge + gcloud）

TFC の `project_id` / `region` / `job_name` と **同じ値**を [`.env.example`](../../../.env.example) 参照してルート `.env` に書く（Git にコミットしない）。

```bash
# 例（値は各自）
GCP_PROJECT_ID=...
GCP_REGION=asia-northeast1
GCP_RUN_JOB_NAME=audio-transcode
# GCP_SERVICE_ACCOUNT_JSON=  … apply 後 §3.1
```

Cloud Build や IAM 用シェルでは:

```bash
source scripts/gcp-env.sh   # GCP_PROJECT_ID / GCP_REGION を export
```

`terraform plan` / `apply` は TFC 上の Remote run なので **TFC の variable set** を読む（`.env` は Terraform には渡さない）。

### 1.3 Terraform 初期化

```bash
cd infra/gcp/audio-transcode
terraform login
terraform init
```

## 2. GCP インフラ（2 段階 apply）

### 2.1 Artifact Registry と SA のみ（Job はまだ）

`image` が未ビルドでも通るよう、Job 以外だけ作る。

```bash
cd infra/gcp/audio-transcode

terraform apply \
  -target=google_project_service.required \
  -target=google_artifact_registry_repository.podcaster \
  -target=google_service_account.runner \
  -target=google_service_account.invoker \
  -target=google_artifact_registry_repository_iam_member.runner_pull \
  -target=google_project_iam_custom_role.transcode_invoker \
  -target=google_project_iam_member.invoker_custom
```

### 2.2 コンテナイメージ

TFC の `project_id` / `region` と揃った **`.env`** で build する。

#### Cloud Build の IAM（初回のみ）

`gcloud builds submit` は **ログイン中の Google アカウント**に権限が必要。ソースを `gs://<project>_cloudbuild/` に上げる段階で `PERMISSION_DENIED` になる場合は、**プロジェクトの Owner** が次を実行する（または Console → IAM）。

```bash
cd services/audio-transcode
source ../../scripts/gcp-env.sh

YOUR_EMAIL="$(gcloud config get-value account)"

gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com \
  --project="$GCP_PROJECT_ID"

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="user:${YOUR_EMAIL}" \
  --role="roles/cloudbuild.builds.editor"

PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')"
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

確認:

```bash
gcloud config set project "$GCP_PROJECT_ID"
gcloud auth print-access-token >/dev/null && echo "gcloud ok"
```

Terraform の `-target` apply で `cloudbuild.googleapis.com` も有効化される。API だけ有効で IAM が無いと同じエラーになる。

#### build

```bash
# 上記 IAM ブロックで cd services/audio-transcode && source ../../scripts/gcp-env.sh 済みなら

gcloud builds submit \
  --project "$GCP_PROJECT_ID" \
  --config cloudbuild.yaml \
  --substitutions=_REGION="$GCP_REGION",_REPOSITORY=podcaster,_IMAGE=audio-transcode,_TAG=latest \
  .
```

§2.3 の `terraform apply` 前に TFC `project_id` が実値であること（`image` 行は不要。URI は `project_id` から組み立てる）。

### 2.3 Cloud Run Job 込みのフル apply

Cloud Build 済みなら apply する（TFC の `project_id` がプレースホルダのままだと Artifact Registry 403 になる）。

```bash
cd ../../infra/gcp/audio-transcode
terraform apply
```

state は Terraform Cloud に記録される。ローカルに `terraform.tfstate` はできない（`.gitignore`）。

## 3. Supabase 連携

Terraform は **GCP リソース**だけ作る。Edge が Cloud Run を呼ぶ設定は **Supabase Edge Secrets**（+ トランスコードの ON/OFF は **`podcast_config`**）に載せる。

### 3.0 Terraform output を控える

```bash
cd infra/gcp/audio-transcode
terraform output
terraform output -raw invoker_service_account_email
terraform output -json gcp_edge_env
```

`gcp_edge_env` が TFC 変数と `.env` の `GCP_*` と一致していることを確認する。

### 3.1 Edge Function Secrets — GCP（認証 + Run Job の向き先）

| Secret / env 名 | 内容 |
|-----------------|------|
| **`GCP_SERVICE_ACCOUNT_JSON`** | invoker SA（`terraform output -raw invoker_service_account_email`）の JSON 鍵全文 |
| **`GCP_PROJECT_ID`** | TFC workspace `project_id` と同値（省略時は SA JSON の `project_id` フィールド） |
| **`GCP_REGION`** | TFC `region` または default `asia-northeast1` |
| **`GCP_RUN_JOB_NAME`** | TFC `job_name` または default `audio-transcode` |

| 項目 | 内容 |
|------|------|
| **誰が読む** | `job-worker` 内 `render_audio` → `_shared/transcode/` |
| **置き場（本番）** | Supabase Dashboard → **Project Settings** → **Edge Functions** → **Secrets** |

鍵を作る:

```bash
cd infra/gcp/audio-transcode
source ../../../scripts/gcp-env.sh
INVOKER="$(terraform output -raw invoker_service_account_email)"
gcloud iam service-accounts keys create /tmp/podcaster-invoker.json \
  --iam-account="$INVOKER" \
  --project="$GCP_PROJECT_ID"
```

**リモート（本番）への載せ方（いずれか）**

| 方法 | 手順 |
|------|------|
| **A. deploy 経由** | ルート `.env` に `GCP_*` 4 キー（`GCP_SERVICE_ACCOUNT_JSON` は `jq -c . /tmp/podcaster-invoker.json` の 1 行）。`pnpm deploy`（`supabase secrets set --env-file .env`） |
| **B. CLI のみ** | `supabase secrets set GCP_PROJECT_ID=… GCP_REGION=… GCP_RUN_JOB_NAME=…` と `GCP_SERVICE_ACCOUNT_JSON="$(jq -c . …)"` |
| **C. Dashboard** | Secrets に上記 Name / Value |

**ローカル**（`pnpm functions:serve`）: ルート `.env` に同じ 4 キー。Studio の Edge Secrets はローカル Docker には自動で入らない。

鍵ファイルは git に含めず、設定後削除してよい。`GCP_PROJECT_ID` も **`.env` / Secrets のみ**（`config.toml` や `podcast_config` には載せない）。

### 3.2 トランスコード設定 — `config.toml` → `podcast_config`

TTS や `image.*` と同じ経路。**ルート [`config.toml`](../../../config.toml)** の `[audio]` / `[audio.transcode]` を `seed-config.ts` が **`public.podcast_config`** に upsert する。

GCP 準備完了後、例:

```toml
[audio]
delivery_format = "m4a"

[audio.transcode]
enabled = true
bitrate_kbps = 128
container = "m4a"
```

反映:

```bash
pnpm seed:config
# または deploy 末尾でも同じ seed が走る
pnpm deploy
```

ローカル Supabase: `TARGET=local pnpm seed:config`

| `podcast_config` key | `config.toml` |
|----------------------|---------------|
| `audio.delivery.format` | `[audio] delivery_format` |
| `audio.transcode.enabled` | `[audio.transcode] enabled` |
| `audio.transcode.bitrate_kbps` | `[audio.transcode] bitrate_kbps` |
| `audio.transcode.container` | `[audio.transcode] container` |

Studio / ad hoc SQL はデバッグ用。日常は `config.toml` を正本にする。

### 3.3 Edge Functions のデプロイ

transcode コードは **`job-worker`** と **`external-operation-poller`**。

```bash
pnpm deploy
# または:
supabase functions deploy job-worker external-operation-poller --no-verify-jwt
```

main マージ後の CI deploy でもよい（当該 functions が含まれること）。

### 3.4 スモーク

1. Edge Secrets（§3.1）と `podcast_config` の transcode 有効化（§3.2）が揃っている  
2. 記事を 1 本 ingest（events パイプライン）  
3. `jobs.external_operations` に `projects/.../executions/...`、Storage に `audio/{episodeId}.m4a`、RSS enclosure の length ≠ 0  

```bash
TARGET=remote pnpm cli status <article_id>
TARGET=remote pnpm pipeline:status
```

### 3.5 どこに何を置くか

| 設定 | 正本 | Git |
|------|------|-----|
| Terraform `project_id` 等 | **TFC variable set** | 載せない |
| `audio.transcode.*` / `audio.delivery.format` | **`config.toml`** → `seed:config` | `config.toml` のみ |
| `GCP_*`（Edge + gcloud） | ルート **`.env`** → deploy / `gcp-env.sh` | 載せない |
| tfstate | Terraform Cloud | いいえ |
| `.tf` リソース定義 | Git | はい |

## 4. イメージ更新（再デプロイ）

1. `gcloud builds submit`（§2.2 と同じ。`:latest` 固定なら TFC 変数変更は不要）
2. Cloud Run Job は `lifecycle.ignore_changes` で image 差分を Terraform が無視する — **push するだけ**で次回 Execution から新イメージ
3. Edge / `podcast_config` の変更があるときだけ `pnpm deploy`

## 5. 変更の流れ（日常）

1. `.tf` を PR で変更（変数は TFC UI / 必要なら `.env` の `GCP_*` も同期）
2. `terraform plan`（TFC 上の Remote run。state ロックも TFC）
3. `main` merge 後 `terraform apply`、または apply 担当が PR 確認後に実行
4. TFC 変数や output が変わったら `.env` / Supabase Edge Secrets（§3.1）を更新

## 参考

- [TFC.md](./TFC.md) — state・variable set・認証・Remote run の挙動
- GitHub secret **`TF_API_TOKEN`** — PR 上の `terraform validate`（任意）
