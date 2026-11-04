# audio-transcode (Cloud Run Job)

ffmpeg で WAV → AAC (m4a) に変換し、Supabase Storage の署名 URL 経由で入出力する。

## 環境変数

| 変数 | 説明 |
|------|------|
| `INPUT_URL` | staging WAV の署名 GET URL |
| `OUTPUT_UPLOAD_URL` | `audio/{episodeId}.m4a` への署名 PUT URL |
| `BITRATE_KBPS` | 既定 `128` |

成功時、最終行に JSON（`output_byte_size`, `duration_ms`）を stdout へ出す。

## ビルドとデプロイ

**IaC（推奨）:** [infra/gcp/audio-transcode/README.md](../../infra/gcp/audio-transcode/README.md) — Terraform Cloud + `cloudbuild.yaml`

手動の例:

```bash
# Artifact Registry 例
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_REGION=asia-northeast1,_REPOSITORY=podcaster,_IMAGE=audio-transcode,_TAG=latest .
```

設計: [docs/architecture/audio-transcode-cloud-run.md](../../docs/architecture/audio-transcode-cloud-run.md)
