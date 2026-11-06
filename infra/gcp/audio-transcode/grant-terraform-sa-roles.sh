#!/usr/bin/env bash
# Grant IAM for the GCP service account used as TFC GOOGLE_CREDENTIALS
# (infra/gcp/audio-transcode). Run as a project Owner (or IAM Admin).
#
# Usage:
#   export GCP_PROJECT_ID=my-gcp-project
#   export TF_SA_EMAIL=terraform-audio-transcode@my-gcp-project.iam.gserviceaccount.com
#   ./grant-terraform-sa-roles.sh
#
# Optional: create the SA and a key (then paste JSON into TFC GOOGLE_CREDENTIALS):
#   CREATE_TF_SA=1 ./grant-terraform-sa-roles.sh
#
# After stage-1 terraform apply (runner SA exists), grant actAs for Cloud Run Job:
#   GRANT_RUNNER_ACT_AS=1 ./grant-terraform-sa-roles.sh
#
# If TFC plan fails with Cloud Resource Manager API disabled: enable it on the
# project that OWNS this service account (JSON "project_id"), not only on the
# Terraform target project. See TFC.md § "Cloud Resource Manager API".
#
set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${TF_SA_EMAIL:?Set TF_SA_EMAIL (Terraform / TFC service account email)}"

TF_SA_MEMBER="serviceAccount:${TF_SA_EMAIL}"
RUNNER_SA_ID="${RUNNER_SA_ID:-podcaster-audio-run}"
RUNNER_SA_EMAIL="${RUNNER_SA_ID}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

bind_project_role() {
  local role="$1"
  echo "→ ${role}"
  gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="$TF_SA_MEMBER" \
    --role="$role" \
    --quiet >/dev/null
}

# Predefined roles that match main.tf (practical minimum; not single custom role).
# See TFC.md and comments in this file for a tighter custom-role list.
PROJECT_ROLES=(
  roles/serviceusage.serviceUsageAdmin   # google_project_service (Run, AR, Cloud Build API)
  roles/artifactregistry.admin           # AR repo + repository IAM for runner pull
  roles/run.admin                        # google_cloud_run_v2_job + job IAM member
  roles/iam.serviceAccountAdmin          # invoker + runner service accounts
  roles/iam.roleAdmin                    # google_project_iam_custom_role (transcode invoker)
  roles/viewer                           # project metadata reads during plan
)

echo "Project: ${GCP_PROJECT_ID}"
echo "Terraform SA: ${TF_SA_EMAIL}"
echo ""

if [[ "${CREATE_TF_SA:-0}" == "1" ]]; then
  SA_ID="${TF_SA_ID:-terraform-audio-transcode}"
  if gcloud iam service-accounts describe "$TF_SA_EMAIL" --project="$GCP_PROJECT_ID" &>/dev/null; then
    echo "SA already exists: ${TF_SA_EMAIL}"
  else
    echo "Creating service account ${SA_ID} …"
    gcloud iam service-accounts create "$SA_ID" \
      --project="$GCP_PROJECT_ID" \
      --display-name="HCP Terraform podcaster-audio-transcode"
  fi
  KEY_PATH="${TF_SA_KEY_PATH:-/tmp/${SA_ID}-key.json}"
  echo "Creating key → ${KEY_PATH} (store in TFC GOOGLE_CREDENTIALS, then delete local file)"
  gcloud iam service-accounts keys create "$KEY_PATH" \
    --iam-account="$TF_SA_EMAIL" \
    --project="$GCP_PROJECT_ID"
  echo ""
fi

echo "Binding project-level roles …"
for role in "${PROJECT_ROLES[@]}"; do
  bind_project_role "$role"
done
echo "Done (project roles)."
echo ""
echo "NOT granted: roles/resourcemanager.projectIamAdmin — this stack binds the invoker"
echo "custom role on the Cloud Run Job only (google_cloud_run_v2_job_iam_member), not project IAM."
echo ""

if [[ "${GRANT_RUNNER_ACT_AS:-0}" == "1" ]]; then
  if ! gcloud iam service-accounts describe "$RUNNER_SA_EMAIL" --project="$GCP_PROJECT_ID" &>/dev/null; then
    echo "Runner SA not found: ${RUNNER_SA_EMAIL}"
    echo "Run terraform apply -target=google_service_account.runner first (README §2.1)."
    exit 1
  fi
  echo "Granting roles/iam.serviceAccountUser on runner SA (Cloud Run Job actAs) …"
  gcloud iam service-accounts add-iam-policy-binding "$RUNNER_SA_EMAIL" \
    --project="$GCP_PROJECT_ID" \
    --member="$TF_SA_MEMBER" \
    --role="roles/iam.serviceAccountUser" \
    --quiet >/dev/null
  echo "Done. You can now apply google_cloud_run_v2_job (README §2.3)."
else
  echo "Before full apply that creates the Cloud Run Job, run once runner SA exists:"
  echo "  GRANT_RUNNER_ACT_AS=1 GCP_PROJECT_ID=${GCP_PROJECT_ID} TF_SA_EMAIL=${TF_SA_EMAIL} $0"
fi
