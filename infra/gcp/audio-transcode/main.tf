locals {
  image = coalesce(
    var.image,
    "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_registry_repository_id}/audio-transcode:latest",
  )
}

resource "google_project_service" "required" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
  ])
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "podcaster" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_registry_repository_id
  description   = "Podcaster container images (audio-transcode, etc.)"
  format        = "DOCKER"

  depends_on = [google_project_service.required]
}

resource "google_service_account" "runner" {
  project      = var.project_id
  account_id   = var.runner_service_account_id
  display_name = "Podcaster audio-transcode job runtime"
}

resource "google_service_account" "invoker" {
  project      = var.project_id
  account_id   = var.invoker_service_account_id
  display_name = "Supabase Edge — invoke audio-transcode Cloud Run Job"
}

resource "google_artifact_registry_repository_iam_member" "runner_pull" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.podcaster.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.runner.email}"
}

resource "google_project_iam_custom_role" "transcode_invoker" {
  role_id     = "podcasterAudioTranscodeInvoker"
  title       = "Podcaster audio transcode invoker"
  description = "Run Cloud Run Job audio-transcode and poll executions (Supabase Edge)."
  permissions = [
    "run.jobs.get",
    "run.jobs.run",
    "run.jobs.runWithOverrides",
    "run.executions.get",
  ]
}

resource "google_cloud_run_v2_job_iam_member" "invoker" {
  project  = google_cloud_run_v2_job.audio_transcode.project
  location = google_cloud_run_v2_job.audio_transcode.location
  name     = google_cloud_run_v2_job.audio_transcode.name
  role     = google_project_iam_custom_role.transcode_invoker.id
  member   = "serviceAccount:${google_service_account.invoker.email}"
}

resource "google_cloud_run_v2_job" "audio_transcode" {
  project  = var.project_id
  name     = var.job_name
  location = var.region

  template {
    template {
      service_account = google_service_account.runner.email
      timeout         = var.task_timeout
      max_retries     = var.max_retries

      containers {
        image = local.image
        resources {
          limits = {
            cpu    = var.cpu
            memory = var.memory
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_artifact_registry_repository_iam_member.runner_pull,
  ]

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
    ]
  }
}
