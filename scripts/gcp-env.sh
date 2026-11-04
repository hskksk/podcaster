#!/usr/bin/env bash
# Load GCP_PROJECT_ID / GCP_REGION / GCP_RUN_JOB_NAME from repo root .env for gcloud / Cloud Build.
# Terraform reads project_id from TFC workspace variables — keep .env in sync for Edge + gcloud.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi
: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID in repo root .env (same value as TFC workspace project_id)}"
export GCP_REGION="${GCP_REGION:-asia-northeast1}"
export GCP_RUN_JOB_NAME="${GCP_RUN_JOB_NAME:-audio-transcode}"
