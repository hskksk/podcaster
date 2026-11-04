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

手順の正本: [infra/gcp/audio-transcode/README.md](../../infra/gcp/audio-transcode/README.md)

- 変数: Git の [`terraform.tfvars`](../../infra/gcp/audio-transcode/terraform.tfvars)
- state: Terraform Cloud（[TFC.md](../../infra/gcp/audio-transcode/TFC.md)）
- イメージ build: 同 README §2.2（`cloudbuild.yaml`）

```bash
# README §2.2 参照（project_id / region は terraform.tfvars から読む）
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_REGION=asia-northeast1,_REPOSITORY=podcaster,_IMAGE=audio-transcode,_TAG=latest .
```

設計: [docs/architecture/audio-transcode-cloud-run.md](../../docs/architecture/audio-transcode-cloud-run.md)
