# Git 管理の Terraform 変数（secret は載せない）。
# project_id / image のプレースホルダを実値に差し替えてから apply する。

project_id = "your-gcp-project-id"
region     = "asia-northeast1"
job_name   = "audio-transcode"

# 初回: AR だけ apply → cloud build → この URI を実値に更新 → フル apply
image = "asia-northeast1-docker.pkg.dev/your-gcp-project-id/podcaster/audio-transcode:latest"
