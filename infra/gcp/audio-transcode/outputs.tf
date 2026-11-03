output "artifact_registry_repository" {
  description = "Artifact Registry repository resource name."
  value       = google_artifact_registry_repository.podcaster.name
}

output "default_image_uri" {
  description = "Example image URI after first push (tag latest)."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_registry_repository_id}/audio-transcode:latest"
}

output "cloud_run_job_name" {
  description = "Full Cloud Run Job resource name (Run API parent for :run)."
  value       = google_cloud_run_v2_job.audio_transcode.name
}

output "cloud_run_job_id" {
  value = google_cloud_run_v2_job.audio_transcode.id
}

output "invoker_service_account_email" {
  description = "Create a JSON key for this SA → Supabase secret GCP_SERVICE_ACCOUNT_JSON."
  value       = google_service_account.invoker.email
}

output "runner_service_account_email" {
  value = google_service_account.runner.email
}

output "podcast_config_gcp_keys" {
  description = "Values to set in podcast_config after apply."
  value = {
    "gcp.project_id"   = var.project_id
    "gcp.region"       = var.region
    "gcp.run.job_name" = var.job_name
  }
}
