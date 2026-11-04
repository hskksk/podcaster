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

Terraform **output** を Supabase に反映する（tfvars / state とは別経路）。

| 出力 | 反映先 |
|------|--------|
| `invoker_service_account_email` | この SA の JSON キー → Secret **`GCP_SERVICE_ACCOUNT_JSON`** |
| `podcast_config_gcp_keys` | テーブル **`podcast_config`** の `gcp.project_id` / `gcp.region` / `gcp.run.job_name` |
| （運用） | `audio.transcode.enabled` = `true`、`audio.delivery.format` = `m4a` |

Invoker 鍵の例:

```bash
gcloud iam service-accounts keys create invoker.json \
  --iam-account "$(terraform output -raw invoker_service_account_email)"
supabase secrets set --env-file /dev/null  # リモート deploy 時は .env 経由
# 例: supabase secrets set GCP_SERVICE_ACCOUNT_JSON="$(jq -c . invoker.json)"
```

アプリデプロイ:

```bash
pnpm deploy   # または CI の main deploy
```

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
