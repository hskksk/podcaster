# audio-transcode Terraform — Terraform Cloud

**tfstate** と **Terraform 入力変数（`project_id` など）** の正本は Terraform Cloud workspace **`podcaster-audio-transcode`**。Git に `terraform.tfvars` は置かない。

関連: [README.md](./README.md) デプロイ手順、[audio-transcode-cloud-run.md](../../../docs/architecture/audio-transcode-cloud-run.md)。

## 役割分担

```text
Git (podcaster repo)
  infra/gcp/audio-transcode/*.tf     ← リソース定義・variables.tf の default のみ

Terraform Cloud (app.terraform.io)
  workspace: podcaster-audio-transcode
    ├── state + run 履歴
    └── Terraform variables
          project_id  (Sensitive, 必須)
          region      (任意 — 省略時は variables.tf default)
          job_name    (任意)

ルート .env（gitignore）
  GCP_*  … Cloud Build / gcloud / Supabase Edge（TFC の project_id と同値に揃える）

Supabase Edge Secrets
  GCP_*  … deploy 時に .env から反映
  podcast_config audio.transcode.*  ← config.toml → seed
```

## なぜ Terraform Cloud か

GCS バックエンド用バケットの bootstrap が不要で、ロックと run 履歴が標準で付く。このスタックは workspace 1 つで足りる。

## Workspace の作り方

1. [app.terraform.io](https://app.terraform.io) で Organization を用意（名称が `hskksk` でない場合は [`versions.tf`](./versions.tf) の `organization` を合わせる）。
2. **New workspace** → **CLI-driven workflow**。
3. Name: **`podcaster-audio-transcode`**（`versions.tf` の `workspaces.name` と一致）。
4. **Execution mode = Local**（推奨）
   - **State**: Terraform Cloud
   - **Plan / apply**: 手元 CLI。GCP は `gcloud auth application-default login`
   - Workspace に **`GOOGLE_CREDENTIALS` は不要**（Local 実行時）

Remote execution に切り替える場合だけ、Terraform 用 SA JSON を TFC の Environment variable `GOOGLE_CREDENTIALS`（Sensitive）に置く。

## Workspace 変数（必須セットアップ）

Workspace → **Variables** → **Workspace variables**（Terraform category）:

| Key | Category | Sensitive | 値 |
|-----|----------|-----------|-----|
| `project_id` | Terraform | **Yes** | 実 GCP プロジェクト ID |
| `region` | Terraform | No | 省略可（default `asia-northeast1`） |
| `job_name` | Terraform | No | 省略可（default `audio-transcode`） |

`TF_VAR_*` やローカル `*.tfvars` で上書きしない（TFC が正本）。

初回 apply 前に、同じ `project_id` をルート **`.env`** の `GCP_PROJECT_ID` にも書く（Cloud Build・Edge 用。[`scripts/gcp-env.sh`](../../../scripts/gcp-env.sh) が読む）。

### CLI ログイン

```bash
terraform login
cd infra/gcp/audio-transcode
terraform init
terraform plan    # project_id は TFC から注入、state は TFC
```

## GCP 認証（2 種類）

| 用途 | 権限 | 置き場 |
|------|------|--------|
| **Terraform apply** | AR / Run / IAM / SA 作成 | Local 実行時: 手元 ADC。Remote 実行時: TFC `GOOGLE_CREDENTIALS` |
| **Supabase Edge** | invoker カスタムロール（Run Job API） | **`GCP_SERVICE_ACCOUNT_JSON`** 等（ルート `.env` → `pnpm deploy`） |

## CI（GitHub Actions）

[`.github/workflows/terraform-audio-transcode.yml`](../../../.github/workflows/terraform-audio-transcode.yml):

- `infra/gcp/audio-transcode/**` 変更時に `fmt` / `init` / `validate`
- Repository secret **`TF_API_TOKEN`** がある場合のみ実行（TFC へ init するため）

`plan` / `apply` は PR CI では行わない（GCP ADC が必要）。将来 CI で `plan` する場合も **`project_id` は TFC workspace 変数**から取る（GitHub に duplicate しない）。

## 決定

| 項目 | 方針 |
|------|------|
| **Terraform 変数** | TFC workspace **`podcaster-audio-transcode`**（`project_id` は Sensitive） |
| **tfstate** | 同上 |
| **Git `*.tfvars`** | 使わない（`.gitignore`） |
| Organization | 既定 `hskksk`（`versions.tf`） |
| ローカル `terraform.tfstate` | 使わない |
| Edge / gcloud | ルート **`.env`** の `GCP_*`（TFC と同値） |
