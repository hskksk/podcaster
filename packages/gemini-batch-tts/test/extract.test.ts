/**
 * Quick simulation: write the user's sample JSONL line to a temp file, run
 * extractAudioToPcmFile against it, and verify mimeType + pcm bytes come out.
 *
 * Run with: node --experimental-strip-types packages/gemini-batch-tts/test/extract.test.ts
 * (no install needed; uses only Node built-ins.)
 */

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { extractAudioToPcmFile } from "../src/index.ts";

const data = "A".repeat(800); // 600 bytes after base64 decode (well, 800 'A's = 800 base64 chars = 600 PCM bytes; here it's all-zero PCM)
const sampleLine = JSON.stringify({
  response: {
    responseId: "WRH_afSYJ8iN_uMP0NXzqAo",
    usageMetadata: {
      promptTokensDetails: [{ tokenCount: 12, modality: "TEXT" }],
      promptTokenCount: 12,
      candidatesTokenCount: 82,
      candidatesTokensDetails: [{ tokenCount: 82, modality: "AUDIO" }],
      totalTokenCount: 94,
      serviceTier: "SERVICE_TIER_STANDARD",
    },
    modelVersion: "gemini-3.1-flash-tts-preview",
    candidates: [
      {
        content: {
          role: "model",
          parts: [
            {
              inlineData: {
                data,
                mimeType: "audio/l16; rate=24000; channels=1",
              },
            },
          ],
        },
        index: 0,
        finishReason: "STOP",
      },
    ],
  },
  key: "tts-1",
});

const work = mkdtempSync(join(tmpdir(), "gemini-tts-test-"));
const jsonlPath = join(work, "result.jsonl");
const pcmPath = join(work, "audio.pcm");
writeFileSync(jsonlPath, sampleLine + "\n");

// Tiny highWaterMark forces the data field, mimeType needle, and the
// boundary between them to all straddle multiple read chunks.
const result = await extractAudioToPcmFile(
  { apiKey: "x", highWaterMark: 17 },
  jsonlPath,
  pcmPath,
);

assert.equal(result.mimeType, "audio/l16; rate=24000; channels=1");
assert.equal(result.pcmBytes, 600);
const pcm = readFileSync(pcmPath);
assert.equal(pcm.length, 600);
assert.ok(pcm.every((b) => b === 0), "all PCM bytes should decode to 0x00");
console.log("ok", result);
