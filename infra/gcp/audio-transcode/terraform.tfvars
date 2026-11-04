# Git 管理の Terraform 変数（secret は載せない）。
# project_id だけ実 GCP プロジェクト ID に差し替える（プレースホルダのまま apply しない）。

project_id = "your-gcp-project-id"
region     = "asia-northeast1"
job_name   = "audio-transcode"

# image は省略可。省略時は
# {region}-docker.pkg.dev/{project_id}/podcaster/audio-transcode:latest
# を Cloud Run Job に使う（cloud build 後 §2.3 apply）。
