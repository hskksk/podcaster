# GCP IaC — `audio-transcode` Cloud Run Job

Terraform で Artifact Registry・Cloud Run Job・Supabase 用 invoker SA を定義する。

| 正本 | 置き場 |
|------|--------|
| **変数（tfvars）** | Git — このディレクトリの [`terraform.tfvars`](./terraform.tfvars) |
| **state（tfstate）** | [Terraform Cloud](./TFC.md) workspace `podcaster-audio-transcode`（ローカルに state を置かない） |

設計: [audio-transcode-cloud-run.md](../../../docs/architecture/audio-transcode-cloud-run.md)

## 前提

- リポジトリルートで `mise install`（`terraform` / `gcloud` — [`.mise.toml`](../../../.mise.toml)）
- Terraform Cloud: CLI-driven workspace **`podcaster-audio-transcode`**（手順 [TFC.md](./TFC.md)）。Organization 既定 `hskksk`（違えば `versions.tf` を変更）
- `terraform login`
- **Execution mode = Local**（state だけ TFC。plan/apply は手元 + `gcloud auth application-default login`）
- GCP プロジェクトで Billing 有効

## 1. 初回セットアップ

### 1.1 Terraform Cloud

[TFC.md § Workspace](./TFC.md#workspace-の作り方) どおり workspace を 1 つ作成する。

### 1.2 変数（Git）

[`terraform.tfvars`](./terraform.tfvars) を編集する（PR でレビュー可能）。

| 変数 | 必須タイミング | 内容 |
|------|----------------|------|
| `project_id` | 最初の apply 前 | GCP プロジェクト ID（`podcast_config.gcp.project_id` と揃える。**プレースホルダのままにしない**） |
| `region` / `job_name` | 任意 | 既定のままでよいことが多い |
| `image` | 任意 | 省略時は `{region}-docker.pkg.dev/{project_id}/podcaster/audio-transcode:latest` を自動使用 |

`terraform plan` / `apply` は **`terraform.tfvars` を自動読込**する。TFC Workspace 変数には載せない（Git が正本）。

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

`terraform.tfvars` の `project_id` / `region` に合わせて build する。

#### Cloud Build の IAM（初回のみ）

`gcloud builds submit` は **ログイン中の Google アカウント**に権限が必要。ソースを `gs://<project>_cloudbuild/` に上げる段階で `PERMISSION_DENIED` になる場合は、**プロジェクトの Owner** が次を実行する（または Console → IAM）。`PROJECT_ID` は Git 管理の [`terraform.tfvars`](./terraform.tfvars) から読む（project id を README に直書きしない）。

```bash
cd ../../../services/audio-transcode

PROJECT_ID="$(grep -E '^project_id' ../../infra/gcp/audio-transcode/terraform.tfvars | sed -n 's/.*=\s*"\(.*\)".*/\1/p')"
YOUR_EMAIL="$(gcloud config get-value account)"

gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com \
  --project="$PROJECT_ID"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="user:${YOUR_EMAIL}" \
  --role="roles/cloudbuild.builds.editor"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

確認:

```bash
gcloud config set project "$PROJECT_ID"
gcloud auth application-default print-access-token >/dev/null && echo "ADC ok"
```

Terraform の `-target` apply で `cloudbuild.googleapis.com` も有効化される。API だけ有効で IAM が無いと同じエラーになる。

#### build

```bash
# 上記 IAM ブロックで cd services/audio-transcode 済みならそのまま

REGION="$(grep -E '^region' ../../infra/gcp/audio-transcode/terraform.tfvars | sed -n 's/.*=\s*"\(.*\)".*/\1/p')"

gcloud builds submit \
  --project "$PROJECT_ID" \
  --config cloudbuild.yaml \
  --substitutions=_REGION="$REGION",_REPOSITORY=podcaster,_IMAGE=audio-transcode,_TAG=latest \
  .
```

§2.3 の `terraform apply` 前に `project_id` が実値であること（`image` 行は不要。URI は `project_id` から組み立てる）。

### 2.3 Cloud Run Job 込みのフル apply

Cloud Build 済みで [`terraform.tfvars`](./terraform.tfvars) の **`project_id` が実プロジェクト ID** なら、そのまま apply する（`image` に `your-gcp-project-id` が残っていると Artifact Registry 403 になる）。

```bash
cd ../../infra/gcp/audio-transcode
terraform apply
```

state は Terraform Cloud に記録される。ローカルに `terraform.tfstate` はできない（`.gitignore`）。

## 3. Supabase 連携

Terraform は **GCP リソース**だけ作る。Edge が Cloud Run を呼ぶ設定は **Supabase**（Secret + `podcast_config`）に載せる。

### 3.0 Terraform output を控える

```bash
cd infra/gcp/audio-transcode
terraform output
terraform output -raw invoker_service_account_email
terraform output -json podcast_config_gcp_keys
```

### 3.1 Edge Function Secret — `GCP_SERVICE_ACCOUNT_JSON`

| 項目 | 内容 |
|------|------|
| **何** | **invoker** SA（`terraform output -raw invoker_service_account_email`）の JSON 鍵全文 |
| **誰が読む** | `job-worker` 内 `render_audio` → `_shared/transcode/gcp-token.ts` |
| **置き場** | Supabase Dashboard → **Project Settings** → **Edge Functions** → **Secrets** |

鍵を作る:

```bash
cd infra/gcp/audio-transcode
INVOKER="$(terraform output -raw invoker_service_account_email)"
PROJECT_ID="$(grep -E '^project_id' terraform.tfvars | sed -n 's/.*=\s*"\(.*\)".*/\1/p')"
gcloud iam service-accounts keys create /tmp/podcaster-invoker.json \
  --iam-account="$INVOKER" \
  --project="$PROJECT_ID"
```

**リモート（本番）への載せ方（いずれか）**

| 方法 | 手順 |
|------|------|
| **A. deploy 経由** | ルート `.env` に `GCP_SERVICE_ACCOUNT_JSON=` + `jq -c . /tmp/podcaster-invoker.json` の 1 行。`pnpm deploy`（`supabase secrets set --env-file .env`） |
| **B. CLI のみ** | `supabase secrets set GCP_SERVICE_ACCOUNT_JSON="$(jq -c . /tmp/podcaster-invoker.json)"` |
| **C. Dashboard** | Secrets に Name `GCP_SERVICE_ACCOUNT_JSON`、Value に JSON 全文 |

**ローカル**（`pnpm functions:serve`）: ルート `.env` に同じキー。Studio の Edge Secrets はローカル Docker には自動で入らない。

鍵ファイルは git に含めず、設定後削除してよい。

### 3.2 ランタイム設定 — `config.toml` → `podcast_config`

TTS や `image.*` と同じ経路。**ルート [`config.toml`](../../../config.toml)** に書き、`seed-config.ts` が **`public.podcast_config`** に upsert する。Studio で 1 行ずつ触る必要はない（上書き確認用なら可）。

Terraform apply 後、次を **`terraform.tfvars` / output と揃える**:

```toml
[gcp]
project_id = "..."   # terraform.tfvars の project_id（空のまま seed しない）
region = "asia-northeast1"
run_job_name = "audio-transcode"

[audio]
delivery_format = "m4a"

[audio.transcode]
enabled = true       # GCP 準備完了後に true
bitrate_kbps = 128
container = "m4a"
```

反映:

```bash
# リモート DB のみ更新
pnpm seed:config

# または deploy 末尾でも同じ seed が走る
pnpm deploy
```

ローカル Supabase: `TARGET=local pnpm seed:config`

**上書き:** `.env` の `GCP_PROJECT_ID` / `GCP_REGION` / `GCP_RUN_JOB_NAME` が `[gcp]` より優先（CI 向け）。`GCP_SERVICE_ACCOUNT_JSON` は **podcast_config には入れない**（§3.1 の Edge Secret のみ）。

| `podcast_config` key | `config.toml` |
|----------------------|---------------|
| `gcp.project_id` | `[gcp] project_id` |
| `gcp.region` | `[gcp] region` |
| `gcp.run.job_name` | `[gcp] run_job_name` |
| `audio.delivery.format` | `[audio] delivery_format` |
| `audio.transcode.enabled` | `[audio.transcode] enabled` |
| `audio.transcode.bitrate_kbps` | `[audio.transcode] bitrate_kbps` |

Studio /  ad hoc SQL はデバッグ用。日常は `config.toml` を正本にする。

### 3.3 Edge Functions のデプロイ

transcode コードは **`job-worker`** と **`external-operation-poller`**。

```bash
pnpm deploy
# または:
supabase functions deploy job-worker external-operation-poller --no-verify-jwt
```

main マージ後の CI deploy でもよい（当該 functions が含まれること）。

### 3.4 スモーク

1. Secret と `podcast_config`（§3.1–3.2）が揃っている  
2. 記事を 1 本 ingest（events パイプライン）  
3. `jobs.external_operations` に `projects/.../executions/...`、Storage に `audio/{episodeId}.m4a`、RSS enclosure の length ≠ 0  

```bash
TARGET=remote pnpm cli status <article_id>
TARGET=remote pnpm pipeline:status
```

### 3.5 どこに何を置くか

| 設定 | 正本 | Git |
|------|------|-----|
| `gcp.*` / `audio.transcode.*`（DB 行） | ルート **`config.toml`** → `pnpm seed:config` | `config.toml` に書く（project id は各自） |
| invoker 鍵 | Edge Secret **`GCP_SERVICE_ACCOUNT_JSON`** | **載せない**（`.env`） |
| tfstate | Terraform Cloud | いいえ |
| GCP リソース | Terraform + tfvars | tfvars の `project_id` のみ |

## 4. イメージ更新（再デプロイ）

1. `gcloud builds submit`（§2.2 と同じ。`image` URI が `:latest` 固定なら tfvars 変更は不要）
2. Cloud Run Job は `lifecycle.ignore_changes` で image 差分を Terraform が無視する — **push するだけ**で次回 Execution から新イメージ
3. Edge / `podcast_config` の変更があるときだけ `pnpm deploy`

## 5. 変更の流れ（日常）

1. `terraform.tfvars` または `.tf` を PR で変更
2. `terraform plan`（手元。state ロックは TFC）
3. `main` merge 後 `terraform apply`、または apply 担当が PR 確認後に実行
4. output が変わったら Supabase Secret / `podcast_config` を更新

## 参考

- [TFC.md](./TFC.md) — state・Workspace・認証の整理
- GitHub secret **`TF_API_TOKEN`** — PR 上の `terraform validate`（任意）
