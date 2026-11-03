# audio-transcode (Cloud Run Job)

ffmpeg で WAV → AAC (m4a) に変換し、Supabase Storage の署名 URL 経由で入出力する。

## 環境変数

| 変数 | 説明 |
|------|------|
| `INPUT_URL` | staging WAV の署名 GET URL |
| `OUTPUT_UPLOAD_URL` | `audio/{episodeId}.m4a` への署名 PUT URL |
| `BITRATE_KBPS` | 既定 `128` |

成功時、最終行に JSON（`output_byte_size`, `duration_ms`）を stdout へ出す。

## ビルドとデプロイ（Phase 0）

```bash
# Artifact Registry 例
gcloud builds submit --tag asia-northeast1-docker.pkg.dev/PROJECT/podcaster/audio-transcode:latest .

gcloud run jobs create audio-transcode \
  --image asia-northeast1-docker.pkg.dev/PROJECT/podcaster/audio-transcode:latest \
  --region asia-northeast1 \
  --cpu 2 --memory 2Gi --task-timeout 900 --max-retries 1
```

実行 SA に `run.jobs.run` / `run.executions.get` を付与する。Supabase Edge 用 SA は Run Job API を呼べればよい。

設計: [docs/architecture/audio-transcode-cloud-run.md](../../docs/architecture/audio-transcode-cloud-run.md)
