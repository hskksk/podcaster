variable "project_id" {
  type        = string
  description = "GCP project ID (same value as podcast_config gcp.project_id)."

  validation {
    condition     = var.project_id != "" && var.project_id != "your-gcp-project-id"
    error_message = "Set project_id in terraform.tfvars to your real GCP project ID (not the placeholder)."
  }
}

variable "region" {
  type        = string
  description = "Cloud Run Job region (e.g. asia-northeast1)."
  default     = "asia-northeast1"
}

variable "job_name" {
  type        = string
  description = "Cloud Run Job name (podcast_config gcp.run.job_name)."
  default     = "audio-transcode"
}

variable "artifact_registry_repository_id" {
  type        = string
  description = "Artifact Registry repository id for container images."
  default     = "podcaster"
}

variable "image" {
  type        = string
  description = "Optional override. Default: {region}-docker.pkg.dev/{project_id}/{artifact_registry_repository_id}/audio-transcode:latest"
  default     = null
  nullable    = true
}

variable "task_timeout" {
  type        = string
  description = "Maximum duration per task (Cloud Run Job timeout)."
  default     = "900s"
}

variable "max_retries" {
  type        = number
  description = "Cloud Run Job max retries per task."
  default     = 1
}

variable "cpu" {
  type        = string
  default     = "2"
}

variable "memory" {
  type        = string
  default     = "2Gi"
}

variable "invoker_service_account_id" {
  type        = string
  description = "Service account id (not email) used by Supabase Edge (GCP_SERVICE_ACCOUNT_JSON). GCP limit: 6–30 chars."
  default     = "podcaster-audio-inv"
}

variable "runner_service_account_id" {
  type        = string
  description = "Service account id for the Job task runtime (pull image, outbound HTTPS only). GCP limit: 6–30 chars."
  default     = "podcaster-audio-run"
}
