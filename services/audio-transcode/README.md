# audio-transcode (Cloud Run Job)

Alpine + ffmpeg。WAV をダウンロード → m4a → 署名 PUT。

環境変数（Job コンテナ）:

| 名前 | 意味 |
|------|------|
| `INPUT_URL` | staging WAV 署名 GET |
| `OUTPUT_UPLOAD_URL` | 公開 m4a 署名 PUT |
| `OUTPUT_OBJECT_PATH` | 例 `audio/{episodeId}/{jobId}.m4a` |
| `BITRATE_KBPS` | ffmpeg `-b:a` |
| `JOB_ID` / `ATTEMPT_ID` | ログ用 |

手順の正本: [infra/gcp/audio-transcode/README.md](../../infra/gcp/audio-transcode/README.md)

- Terraform 変数: [TFC workspace](../../infra/gcp/audio-transcode/TFC.md)（Git に tfvars なし）
- Cloud Build: ルート `.env` の `GCP_*`（`source ../../scripts/gcp-env.sh`）

```bash
cd services/audio-transcode
source ../../scripts/gcp-env.sh
gcloud builds submit \
  --project "$GCP_PROJECT_ID" \
  --config cloudbuild.yaml \
  --substitutions=_REGION="$GCP_REGION",_REPOSITORY=podcaster,_IMAGE=audio-transcode,_TAG=latest \
  .
```

設計: [docs/architecture/audio-transcode-cloud-run.md](../../docs/architecture/audio-transcode-cloud-run.md)
