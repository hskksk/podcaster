#!/usr/bin/env bash
set -euo pipefail

: "${INPUT_URL:?INPUT_URL required}"
: "${OUTPUT_UPLOAD_URL:?OUTPUT_UPLOAD_URL required}"
: "${BITRATE_KBPS:=128}"

INPUT_PATH="/tmp/input.wav"
OUTPUT_PATH="/tmp/out.m4a"

echo "[audio-transcode] download wav"
curl -fsSL "$INPUT_URL" -o "$INPUT_PATH"

echo "[audio-transcode] ffmpeg transcode"
ffmpeg -hide_banner -loglevel error -y -i "$INPUT_PATH" \
  -c:a aac -b:a "${BITRATE_KBPS}k" -movflags +faststart \
  "$OUTPUT_PATH"

OUTPUT_BYTE_SIZE="$(stat -c%s "$OUTPUT_PATH" 2>/dev/null || wc -c < "$OUTPUT_PATH")"
DURATION_MS="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUTPUT_PATH" | awk '{printf "%.0f\n", $1 * 1000}')"

echo "[audio-transcode] upload m4a (${OUTPUT_BYTE_SIZE} bytes)"
curl -fsSL -X PUT "$OUTPUT_UPLOAD_URL" \
  -H "Content-Type: audio/mp4" \
  --data-binary @"$OUTPUT_PATH"

echo "{\"output_byte_size\": ${OUTPUT_BYTE_SIZE}, \"duration_ms\": ${DURATION_MS}}"
