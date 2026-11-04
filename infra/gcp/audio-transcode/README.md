# GCP IaC — `audio-transcode` Cloud Run Job

Terraform で Artifact Registry・Cloud Run Job・Supabase 用 invoker SA を定義する。

設計: [docs/architecture/audio-transcode-cloud-run.md](../../../docs/architecture/audio-transcode-cloud-run.md)

## 前提

- [Terraform](https://www.terraform.io/downloads) >= 1.5（リポジトリルートで `mise install` → `.mise.toml` の `terraform`）
- `gcloud auth application-default login` または `GOOGLE_APPLICATION_CREDENTIALS`
- 対象 GCP プロジェクトで Billing 有効

## 1. イメージをビルドして push

初回は Artifact Registry だけ先に作る（Job はイメージ必須のため）。

```bash
cd infra/gcp/audio-transcode
cp terraform.tfvars.example terraform.tfvars
# project_id のみ編集。image は後で。

terraform init
terraform apply \
  -target=google_project_service.required \
  -target=google_artifact_registry_repository.podcaster \
  -target=google_service_account.runner \
  -target=google_service_account.invoker \
  -target=google_artifact_registry_repository_iam_member.runner_pull \
  -target=google_project_iam_custom_role.transcode_invoker \
  -target=google_project_iam_member.invoker_custom
```

```bash
cd ../../../services/audio-transcode

export PROJECT_ID=your-gcp-project-id
export REGION=asia-northeast1

gcloud builds submit \
  --project "$PROJECT_ID" \
  --config cloudbuild.yaml \
  --substitutions=_REGION="$REGION",_REPOSITORY=podcaster,_IMAGE=audio-transcode,_TAG=latest \
  .
```

`terraform.tfvars` に `image` を設定して Job を作成:

```bash
cd ../../infra/gcp/audio-transcode
terraform apply
```

`apply` 後:

## 2. 出力の使い方

| 出力 | 用途 |
|------|------|
| `invoker_service_account_email` | この SA の JSON キーを `GCP_SERVICE_ACCOUNT_JSON` に |
| `podcast_config_gcp_keys` | `podcast_config` の `gcp.*` |
| `cloud_run_job_name` | デバッグ・Run API のフルリソース名 |

Invoker キー（例）:

```bash
gcloud iam service-accounts keys create invoker.json \
  --iam-account "$(terraform output -raw invoker_service_account_email)"
# Supabase: supabase secrets set GCP_SERVICE_ACCOUNT_JSON="$(cat invoker.json)"
```

## 3. Supabase 側

1. Secret `GCP_SERVICE_ACCOUNT_JSON`
2. `podcast_config`: `gcp.project_id`, `gcp.region`, `gcp.run.job_name`, `audio.transcode.enabled=true`
3. `pnpm deploy`（Edge Functions）

## イメージ更新

Job 定義の `lifecycle.ignore_changes` により、Terraform はコンテナ image タグの差分を無視する。新ビルドは **同じ URI に push**（`:latest` または固定タグ）すれば次回 Execution から反映される。

## State

リモート state は未設定。チーム運用では GCS backend を `versions.tf` に追加すること。
