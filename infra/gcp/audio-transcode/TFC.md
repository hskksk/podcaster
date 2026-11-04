# audio-transcode Terraform — Terraform Cloud

Terraform state と実行履歴は **HashiCorp Terraform Cloud（HCP Terraform）** で管理する。GCS バックエンドの bootstrap は不要。

関連: [audio-transcode-cloud-run.md](../../../docs/architecture/audio-transcode-cloud-run.md) Phase 0、[README.md](./README.md) 手順。

## なぜ Terraform Cloud か

| 項目 | Terraform Cloud | 自前 GCS state |
|------|-----------------|----------------|
| state バケットの作成 | 不要 | 初回 bootstrap が必要 |
| ロック | 標準 | GCS backend で対応可 |
| 実行履歴・plan 保存 | Run UI | 自前で整備 |
| 変数・secret | Workspace 変数 UI | 別管理 |

このスタック（1 Cloud Run Job + AR + SA）は Workspace を 1 つ切る想定で足りる。

## 構成

```text
app.terraform.io
  organization: hskksk  （違う場合は versions.tf の organization を変更）
  workspace:    podcaster-audio-transcode
        │
        ├── state（Terraform Cloud が保持。Git / ローカルに tfstate を置かない）
        ├── Workspace variables（project_id, image, …）
        ├── Sensitive: GOOGLE_CREDENTIALS（Remote 実行時のみ）
        └── Runs（plan / apply の履歴）

GCP
  ├── Terraform 用 SA（apply 権限）── Remote 実行時に TFC へ
  ├── invoker SA（Edge 用・Terraform が作成）── 鍵は Supabase Secret へ
  └── runner SA（Job 実行用・Terraform が作成）
```

**2 種類の GCP 認証を混同しないこと。**

| 用途 | 権限の目安 | 置き場 |
|------|------------|--------|
| **Terraform apply** | AR / Cloud Run / IAM / SA 作成（例: `roles/editor` またはカスタム） | TFC の `GOOGLE_CREDENTIALS`（Remote）またはローカル ADC（Local 実行） |
| **Supabase Edge** | `run.jobs.run` 等（本モジュールの invoker カスタムロール） | Secret `GCP_SERVICE_ACCOUNT_JSON`（Terraform output の invoker SA のキー） |

## Workspace の作り方

1. [app.terraform.io](https://app.terraform.io) で Organization を用意（名称が `hskksk` でない場合は `versions.tf` の `organization` を合わせる）。
2. **New workspace** → **CLI-driven workflow**（まずは CLI で十分。後から VCS 連携に変更可）。
3. Name: **`podcaster-audio-transcode`**（`versions.tf` の `workspaces.name` と一致させる）。
4. **Execution mode**（どちらか）:
   - **Local（おすすめ・最初）**: state だけ TFC。plan/apply は手元 CLI + `gcloud auth application-default login`。GCP 鍵を TFC に載せなくてよい。
   - **Remote**: plan/apply を TFC 上で実行。Workspace に **Environment variable** `GOOGLE_CREDENTIALS`（Sensitive）= Terraform 用 SA の JSON 全文。

### Workspace 変数（Terraform variables）

UI の **Workspace variables** に登録（`category = terraform`）。名前は変数名と同じ。

| Variable | Sensitive | 例 |
|----------|-----------|-----|
| `project_id` | no | `your-gcp-project` |
| `region` | no | `asia-northeast1` |
| `job_name` | no | `audio-transcode` |
| `image` | no | `asia-northeast1-docker.pkg.dev/.../audio-transcode:latest` |

`region` / `job_name` など default 付き変数は未設定でも可。`project_id` と `image` は apply 前に必須。

ローカルだけ試すときは gitignore 済み `terraform.tfvars` や `TF_VAR_project_id` でもよい（state は TFC に上がる）。

### CLI ログイン

```bash
terraform login   # ブラウザで TF API トークン → ~/.terraform.d/credentials.tfc.json
cd infra/gcp/audio-transcode
terraform init
terraform plan
```

## 初回 apply の流れ（Local 実行 + TFC state）

1. Workspace 作成（上記）。
2. `terraform login` → `terraform init`。
3. 変数を TFC Workspace または `terraform.tfvars` に設定。
4. [README.md](./README.md) の `-target` bootstrap → イメージ build → フル `apply`。
5. `terraform output` → Supabase `podcast_config` / Secret（README §2–3）。

## CI（GitHub Actions）

Workflow [`.github/workflows/terraform-audio-transcode.yml`](../../../.github/workflows/terraform-audio-transcode.yml):

- `infra/gcp/audio-transcode/**` 変更時に `fmt` / `init` / `validate`。
- Repository secret **`TF_API_TOKEN`**（Terraform Cloud → User settings → Tokens）がある場合のみ `init` まで実行。

`plan` / `apply` は PR CI では回さない（GCP 認証と Workspace 変数が必要なため）。本番反映は CLI または TFC VCS 連携（将来）。

## 将来: VCS-driven（任意）

Workspace を **Version control workflow** に切り替え、Working directory `infra/gcp/audio-transcode`、`main` merge 時に apply など。導入時は Remote 実行 + `GOOGLE_CREDENTIALS` と apply 承認（Manual apply）を推奨。

## State に含めないもの

- Supabase `GCP_SERVICE_ACCOUNT_JSON`（invoker 鍵）— Terraform state には SA **email** のみ。鍵は apply 後に手動または別スクリプトで Supabase へ。
- `podcast_config` — ランタイム設定。output を見て Dashboard / seed で同期（Terraform Provider で Supabase を触る予定はなし）。

## 決定

| 項目 | 方針 |
|------|------|
| State | Terraform Cloud workspace `podcaster-audio-transcode` |
| Organization | 既定 `hskksk`（要変更時は `versions.tf` のみ編集） |
| tfvars | Workspace 変数を正本。ローカル `terraform.tfvars` は gitignore のまま任意 |
| ローカル tfstate | 使わない（`.gitignore` 維持） |
