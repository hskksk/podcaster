# audio-transcode Terraform — Terraform Cloud（state のみ）

**tfstate** は Terraform Cloud workspace **`podcaster-audio-transcode`** が正本。**tfvars** は Git の [`terraform.tfvars`](./terraform.tfvars) が正本（TFC Workspace 変数には載せない）。

関連: [README.md](./README.md) デプロイ手順、[audio-transcode-cloud-run.md](../../../docs/architecture/audio-transcode-cloud-run.md)。

## 役割分担

```text
Git (podcaster repo)
  infra/gcp/audio-transcode/terraform.tfvars  ← 変数の正本（PR で変更）
  infra/gcp/audio-transcode/*.tf              ← リソース定義

Terraform Cloud (app.terraform.io)
  organization: hskksk
  workspace:    podcaster-audio-transcode
        └── state + run 履歴（tfstate を Git / ローカルに置かない）

Supabase
  podcast_config (gcp.*)  ← terraform output と手動同期
  Secret GCP_SERVICE_ACCOUNT_JSON  ← invoker SA 鍵（Git / state に入れない）
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
   - Workspace に **`GOOGLE_CREDENTIALS` は不要**

Remote execution に切り替える場合だけ、Terraform 用 SA JSON を TFC の Environment variable `GOOGLE_CREDENTIALS`（Sensitive）に置く。

### CLI ログイン

```bash
terraform login
cd infra/gcp/audio-transcode
terraform init
terraform plan    # terraform.tfvars を自動読込、state は TFC
```

## GCP 認証（2 種類）

| 用途 | 権限 | 置き場 |
|------|------|--------|
| **Terraform apply** | AR / Run / IAM / SA 作成 | Local 実行時: 手元 ADC。Remote 実行時: TFC `GOOGLE_CREDENTIALS` |
| **Supabase Edge** | invoker カスタムロール（Run Job API） | Secret **`GCP_SERVICE_ACCOUNT_JSON`**（Terraform が作る invoker SA の鍵） |

## CI（GitHub Actions）

[`.github/workflows/terraform-audio-transcode.yml`](../../../.github/workflows/terraform-audio-transcode.yml):

- `infra/gcp/audio-transcode/**` 変更時に `fmt` / `init` / `validate`
- Repository secret **`TF_API_TOKEN`** がある場合のみ実行（TFC へ init するため）

`plan` / `apply` は PR CI では行わない（GCP ADC が必要）。validate はコミット済み `terraform.tfvars` の構文チェックに使える。

## 将来: Version control workflow（任意）

TFC を **Version control workflow** に切り替え、Working directory `infra/gcp/audio-transcode`、変数は引き続き **Git の tfvars**（VCS から checkout される）。apply は Manual apply + Remote 実行を推奨。

## 決定

| 項目 | 方針 |
|------|------|
| **tfvars** | Git — [`terraform.tfvars`](./terraform.tfvars) |
| **tfstate** | Terraform Cloud workspace `podcaster-audio-transcode` |
| Organization | 既定 `hskksk`（`versions.tf`） |
| ローカル `terraform.tfstate` | 使わない（`.gitignore`） |
| TFC Workspace 変数 | 使わない（Git と二重管理しない） |
