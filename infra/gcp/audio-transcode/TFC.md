# audio-transcode Terraform — Terraform Cloud

**tfstate** と **Terraform 入力変数（`project_id` など）** の正本は Terraform Cloud workspace **`podcaster-audio-transcode`**。Git に `terraform.tfvars` は置かない。

関連: [README.md](./README.md) デプロイ手順、[audio-transcode-cloud-run.md](../../../docs/architecture/audio-transcode-cloud-run.md)。

## 役割分担

```text
Git (podcaster repo)
  infra/gcp/audio-transcode/*.tf     ← リソース定義・variables.tf の default のみ

Terraform Cloud (app.terraform.io)
  workspace: podcaster-audio-transcode
    ├── Execution mode = Remote
    ├── Terraform version = 1.17.1
    ├── state + run 履歴
    └── Variable set `podcaster-audio-transcode`（org-owned）
          ├── project_id          Terraform
          ├── GOOGLE_CREDENTIALS  Environment / Sensitive
          └── region / job_name   Terraform（任意）

ルート .env（gitignore）
  GCP_*  … Cloud Build / gcloud / Supabase Edge（TFC の project_id と同値に揃える）

Supabase Edge Secrets
  GCP_*  … Dashboard → Edge Functions → Secrets
  podcast_config audio.transcode.*  ← config.toml → seed
```

## なぜ Terraform Cloud か

GCS バックエンド用バケットの bootstrap が不要で、ロックと run 履歴が標準で付く。このスタックは workspace 1 つで足りる。

## Workspace の作り方

1. [app.terraform.io](https://app.terraform.io) で Organization を用意（名称が `hskksk` でない場合は [`versions.tf`](./versions.tf) の `organization` を合わせる）。
2. **New workspace** → **CLI-driven workflow**。
3. Name: **`podcaster-audio-transcode`**（`versions.tf` の `workspaces.name` と一致）。
4. **Execution mode = Remote**
   - plan / apply は HCP Terraform のランナー上で実行される。手元の GCP ADC は使わない。
   - **`Local` にすると HCP Terraform は workspace 変数も variable set も評価しない。** その状態で `terraform plan` すると `project_id` の入力を対話で求められる。
5. **Terraform version = `1.17.1`**
   - [`versions.tf`](./versions.tf) の `required_version = "~> 1.17.1"` と CI ([workflow](../../../.github/workflows/terraform-audio-transcode.yml)) に揃える。
6. **Variable set** を作成し、Terraform 用 SA の JSON と `project_id` を入れる（次節）。

SA に必要なロール（[`main.tf`](./main.tf) のリソースに対応）。一括付与: [`grant-terraform-sa-roles.sh`](./grant-terraform-sa-roles.sh)（より狭いカスタムロール一覧は [`terraform-sa-custom-role.permissions`](./terraform-sa-custom-role.permissions)）。

| ロール | 用途 |
|--------|------|
| Service Usage Admin (`roles/serviceusage.serviceUsageAdmin`) | `google_project_service` |
| Artifact Registry Admin (`roles/artifactregistry.admin`) | リポジトリと repository IAM |
| Cloud Run Admin (`roles/run.admin`) | `google_cloud_run_v2_job` と Job IAM |
| Service Account Admin (`roles/iam.serviceAccountAdmin`) | invoker / runner SA 作成 |
| Role Admin (`roles/iam.roleAdmin`) | `google_project_iam_custom_role` |
| Viewer (`roles/viewer`) | プロジェクト属性の読み取り |
| **（Job apply 前に runner SA へ）** Service Account User (`roles/iam.serviceAccountUser`) | Terraform SA → **runner SA** の `iam.serviceAccounts.actAs`（[`README §2.1`](./README.md#21-artifact-registry-と-sa-のみjob-はまだ) のあと `GRANT_RUNNER_ACT_AS=1`） |

**不要（現行 `main.tf`）:** Project IAM Admin — invoker へのカスタムロールは **Job リソース IAM**（`google_cloud_run_v2_job_iam_member`）のみ。プロジェクト IAM binding は作らない。

Execution mode の変更だけでは backend 設定は変わらないため、`terraform init` の再実行は不要。

## Variable set（必須セットアップ）

`project_id` と GCP のサービスアカウント鍵は **Variable set** にまとめる（workspace 変数でも動くが、このリポジトリは set で管理する）。Terraform 変数と環境変数を同じ set に同居させられる。

Variable set の scope で **`podcaster-audio-transcode` を明示的に適用**すること。適用漏れがあると Remote run が `No value for required variable` で失敗する。

| Key | Category | Sensitive | 値 |
|-----|----------|-----------|-----|
| `project_id` | Terraform | No | 実 GCP プロジェクト ID |
| `GOOGLE_CREDENTIALS` | Environment | **Yes** | Terraform 用 SA の JSON 鍵全文 |
| `region` | Terraform | No | 省略可（default `asia-northeast1`） |
| `job_name` | Terraform | No | 省略可（default `audio-transcode`） |

`project_id` は **Sensitive にしない**。TFC 上は public ではなく、workspace にアクセスできるメンバーには見えてよい情報だから。Git に置かない理由（public repo だと誰でも見える）は TFC には当てはまらない。Sensitive にすると値を変えるときに削除→再作成が必要になる。

`-var` / `-var-file` / `TF_VAR_*` は Remote run にも転送され、variable set の値を上書きする。恒久的な上書きはしない（TFC が正本）。**priority variable set にすると `-var` も効かなくなる**ので使わない。

初回 apply 前に、同じ `project_id` をルート **`.env`** の `GCP_PROJECT_ID` にも書く（Cloud Build・Edge 用。[`scripts/gcp-env.sh`](../../../scripts/gcp-env.sh) が読む）。

### Terraform 用 SA（JSON）のプロジェクトで Cloud Resource Manager API を有効化

TFC / `terraform plan` が **`Cloud Resource Manager API has not been used in project …` / `SERVICE_DISABLED`**（`cloudresourcemanager.googleapis.com`）で落ちる場合、**`GOOGLE_CREDENTIALS` の JSON に書いてある `project_id`（鍵が属する GCP プロジェクト）** で API を有効にする。課金・API の「consumer」はそのプロジェクトになる。

Owner など強い権限で:

```bash
# JSON の project_id を確認（"project_id": "my-sa-project"）
SA_PROJECT_ID="$(jq -r .project_id <<<"$GOOGLE_CREDENTIALS")"   # またはファイルから読む

gcloud services enable cloudresourcemanager.googleapis.com --project="$SA_PROJECT_ID"
```

Console からなら: **APIs & Services → Library** で「Cloud Resource Manager API」→ Enable。

有効化直後は数分伝播する。これをしないと `google_project_service` / `google_project_iam_*` / IAM policy read がすべて 403 になり、**Terraform 自身では先に有効化できない**（初回だけ手動ブートストラップが必要）。

ターゲットの `project_id`（例: `gen-lang-client-0572779080`）とは別プロジェクトの鍵を使っている場合、まず **鍵のホームプロジェクト** で有効化する（エラーに出る `consumer ... projects/数字` がそのプロジェクト番号）。

### CLI ログイン

```bash
terraform login
cd infra/gcp/audio-transcode
terraform init
terraform plan    # "Running plan in HCP Terraform..." が出れば Remote 実行
```

## Remote run の挙動

| 項目 | 挙動 |
|------|------|
| Ctrl-C | ログ表示が切れるだけ。run は TFC 上で継続し、state ロックも保持される |
| アップロード | 作業ディレクトリ全体が毎回送られる。`.gitignore` は無効で [`.terraformignore`](./.terraformignore) だけが効く |
| `terraform console` | ローカル評価なので TFC の変数は入らない。値の確認は `terraform output` か run のログ |
| lock ファイル | ランナーは Linux。`terraform providers lock -platform=linux_amd64 -platform=darwin_arm64` で両方のハッシュを記録しておく |
| 未コミット変更 | CLI-driven run ではそのままアップロードされ plan に反映される |

## GCP 認証（3 種類）

| 用途 | 権限 | 置き場 |
|------|------|--------|
| **Terraform plan / apply** | AR / Run / IAM / SA 作成 | TFC の variable set 内 **`GOOGLE_CREDENTIALS`**（Environment / Sensitive） |
| **gcloud / Cloud Build** | Cloud Build 実行、鍵作成 | 手元の `gcloud auth login` |
| **Supabase Edge** | invoker カスタムロール（Run Job API） | Dashboard → **Edge Functions → Secrets**（`GCP_*`, `GEMINI_API_KEY`）。`pnpm deploy` / CI では載せない |

## CI（GitHub Actions）

[`.github/workflows/terraform-audio-transcode.yml`](../../../.github/workflows/terraform-audio-transcode.yml):

- `infra/gcp/audio-transcode/**` 変更時に `fmt` / `init` / `validate`
- Repository secret **`TF_API_TOKEN`** がある場合のみ実行（TFC へ init するため）

`plan` / `apply` は PR CI では行わない。`terraform validate` は変数値を要求しないため、`project_id` が無くても通る。将来 CI で `plan` する場合も **`project_id` は TFC の variable set** から取る（GitHub に duplicate しない）。

## 決定

| 項目 | 方針 |
|------|------|
| **Execution mode** | Remote（plan / apply は TFC 上） |
| **Terraform version** | `1.17.1`（code / TFC / CI で一致） |
| **Terraform 変数** | TFC の variable set `podcaster-audio-transcode`（`project_id` / `GOOGLE_CREDENTIALS`） |
| **tfstate** | 同上 |
| **Git `*.tfvars`** | 使わない（`.gitignore`） |
| Organization | 既定 `hskksk`（`versions.tf`） |
| ローカル `terraform.tfstate` | 使わない |
| Edge / gcloud | ルート **`.env`** の `GCP_*`（TFC と同値） |
