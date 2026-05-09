/**
 * Gemini TTS via the Batch API — minimal-memory, fire-and-forget sample.
 *
 * Goals
 * -----
 *   1. Don't block synchronously waiting for TTS. Use `batchGenerateContent`
 *      so Google does the work asynchronously and we just hold on to a job
 *      name. We can submit and disconnect, or poll later.
 *   2. Never load the full audio into memory. The Batch API result for a
 *      file-input job is a JSONL file in the Files API — we stream that
 *      file straight to disk, single-pass-scan it for `mimeType` / `data`,
 *      decode base64 in 4-char-aligned chunks straight into a `.pcm` file,
 *      then prepend a WAV header.
 *
 * Peak resident memory ≈ HIGH_WATER_MARK (64 KiB), independent of the
 * podcast length.
 *
 * REST endpoints used
 * -------------------
 *   • Files API (resumable upload, two-step):
 *       POST  https://generativelanguage.googleapis.com/upload/v1beta/files
 *   • Batch create:
 *       POST  https://generativelanguage.googleapis.com/v1beta/{model}:batchGenerateContent
 *   • Batch get:
 *       GET   https://generativelanguage.googleapis.com/v1beta/{batchName}
 *   • Files API download (streamed):
 *       GET   https://generativelanguage.googleapis.com/v1beta/{fileName}:download?alt=media
 *
 * Usage
 * -----
 *   GEMINI_API_KEY=... npx tsx scripts/gemini-tts-file-download.ts \
 *     submit "Host: こんにちは。\nCoHost: 今日もよろしく。"
 *   # → prints {"batch":"batches/xxx","inputFile":"files/yyy"}
 *
 *   npx tsx scripts/gemini-tts-file-download.ts status batches/xxx
 *   # → prints {"state":"JOB_STATE_RUNNING"} or {"state":"JOB_STATE_SUCCEEDED","output":"files/zzz"}
 *
 *   npx tsx scripts/gemini-tts-file-download.ts fetch batches/xxx out.wav
 *   # → only succeeds when state=JOB_STATE_SUCCEEDED; writes out.wav with
 *   #   peak memory bounded by the read buffer.
 */

import { createWriteStream } from "node:fs";
import { mkdtemp, open, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { once } from "node:events";

const API_ROOT = "https://generativelanguage.googleapis.com";
const UPLOAD_ROOT = `${API_ROOT}/upload/v1beta/files`;
const MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-2.5-flash-preview-tts";
const HOST_NAME = process.env.GEMINI_TTS_HOST_NAME ?? "Host";
const COHOST_NAME = process.env.GEMINI_TTS_COHOST_NAME ?? "CoHost";
const HOST_VOICE = process.env.GEMINI_TTS_HOST_VOICE ?? "Charon";
const COHOST_VOICE = process.env.GEMINI_TTS_COHOST_VOICE ?? "Achird";
const HIGH_WATER_MARK = 64 * 1024;

function apiKey(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY is not set");
  return k;
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  if (cmd === "submit") {
    const [scriptText] = rest;
    if (!scriptText) usage();
    const result = await submit(scriptText);
    console.log(JSON.stringify(result));
  } else if (cmd === "status") {
    const [batchName] = rest;
    if (!batchName) usage();
    const result = await status(batchName);
    console.log(JSON.stringify(result));
  } else if (cmd === "fetch") {
    const [batchName, outPath = "out.wav"] = rest;
    if (!batchName) usage();
    await fetchResult(batchName, outPath);
  } else {
    usage();
  }
}

function usage(): never {
  console.error(
    [
      "usage:",
      '  tsx scripts/gemini-tts-file-download.ts submit "<script>"',
      "  tsx scripts/gemini-tts-file-download.ts status <batchName>",
      "  tsx scripts/gemini-tts-file-download.ts fetch  <batchName> [out.wav]",
    ].join("\n"),
  );
  process.exit(1);
  throw new Error("unreachable");
}

// ──────────────────────────────────────────────────────────────────────────
// submit: upload tiny JSONL → create batch job → return immediately
// ──────────────────────────────────────────────────────────────────────────

async function submit(
  scriptText: string,
): Promise<{ batch: string; inputFile: string }> {
  // Single-line JSONL: one TTS request. The "key" lets us correlate with the
  // matching response line in the output JSONL.
  const requestLine = JSON.stringify({
    key: "tts-1",
    request: {
      contents: [{ role: "user", parts: [{ text: scriptText }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: HOST_NAME,
                voiceConfig: { prebuiltVoiceConfig: { voiceName: HOST_VOICE } },
              },
              {
                speaker: COHOST_NAME,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: COHOST_VOICE },
                },
              },
            ],
          },
        },
      },
    },
  });
  const body = Buffer.from(requestLine + "\n", "utf8");

  const inputFile = await uploadJsonlFile(body, "tts-batch-input.jsonl");

  const createRes = await fetch(
    `${API_ROOT}/v1beta/models/${MODEL}:batchGenerateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        batch: {
          display_name: "podcast-tts",
          input_config: { file_name: inputFile },
        },
      }),
    },
  );
  if (!createRes.ok) {
    throw new Error(
      `batchGenerateContent ${createRes.status}: ${await createRes.text()}`,
    );
  }
  const createJson = (await createRes.json()) as { name?: string };
  if (!createJson.name) {
    throw new Error(`batch create returned no name: ${JSON.stringify(createJson)}`);
  }
  return { batch: createJson.name, inputFile };
}

/**
 * Files API resumable upload (two-step). For an audio-output TTS sample the
 * input is a few KB, so we send the bytes in one shot in step 2 — but the
 * same code works for arbitrarily large inputs because the SDK protocol
 * supports chunked uploads.
 */
async function uploadJsonlFile(
  bytes: Buffer,
  displayName: string,
): Promise<string> {
  const start = await fetch(`${UPLOAD_ROOT}?key=${apiKey()}`, {
    method: "POST",
    headers: {
      "x-goog-upload-protocol": "resumable",
      "x-goog-upload-command": "start",
      "x-goog-upload-header-content-length": String(bytes.byteLength),
      "x-goog-upload-header-content-type": "application/jsonl",
      "content-type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!start.ok) {
    throw new Error(`upload start ${start.status}: ${await start.text()}`);
  }
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("upload start: missing x-goog-upload-url");

  const finalize = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "content-length": String(bytes.byteLength),
      "x-goog-upload-offset": "0",
      "x-goog-upload-command": "upload, finalize",
    },
    body: bytes,
  });
  if (!finalize.ok) {
    throw new Error(`upload finalize ${finalize.status}: ${await finalize.text()}`);
  }
  const json = (await finalize.json()) as { file?: { name?: string } };
  const name = json.file?.name;
  if (!name) throw new Error(`upload finalize returned no file name: ${JSON.stringify(json)}`);
  return name;
}

// ──────────────────────────────────────────────────────────────────────────
// status: cheap GET, no waiting
// ──────────────────────────────────────────────────────────────────────────

interface BatchStatus {
  state: string;
  output?: string;
  error?: unknown;
}

async function status(batchName: string): Promise<BatchStatus> {
  const res = await fetch(`${API_ROOT}/v1beta/${batchName}`, {
    headers: { "x-goog-api-key": apiKey() },
  });
  if (!res.ok) {
    throw new Error(`batch get ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    metadata?: { state?: string };
    state?: string;
    response?: { dest?: { fileName?: string }; error?: unknown };
    dest?: { fileName?: string };
    error?: unknown;
  };
  const state = json.metadata?.state ?? json.state ?? "UNKNOWN";
  const output =
    json.response?.dest?.fileName ?? json.dest?.fileName ?? undefined;
  const error = json.response?.error ?? json.error;
  return { state, ...(output ? { output } : {}), ...(error ? { error } : {}) };
}

// ──────────────────────────────────────────────────────────────────────────
// fetch: stream the output JSONL → decode base64 chunked → WAV
// ──────────────────────────────────────────────────────────────────────────

async function fetchResult(batchName: string, outPath: string): Promise<void> {
  const st = await status(batchName);
  if (st.state !== "JOB_STATE_SUCCEEDED") {
    throw new Error(
      `batch not ready (state=${st.state})${st.error ? `: ${JSON.stringify(st.error)}` : ""}`,
    );
  }
  if (!st.output) throw new Error("batch SUCCEEDED but no output file name");

  const work = await mkdtemp(join(tmpdir(), "gemini-tts-"));
  const jsonlPath = join(work, "result.jsonl");
  const pcmPath = join(work, "audio.pcm");

  try {
    await downloadFileToDisk(st.output, jsonlPath);
    const { mimeType, pcmBytes } = await extractAudioToPcmFile(jsonlPath, pcmPath);
    const sampleRate = parseSampleRate(mimeType);
    await writeWavFile(outPath, pcmPath, pcmBytes, sampleRate, 1, 16);

    const rss = process.memoryUsage().rss;
    console.log(
      JSON.stringify({
        out: outPath,
        pcmBytes,
        sampleRate,
        mimeType,
        rssMiB: +(rss / 1024 / 1024).toFixed(1),
      }),
    );
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/** Stream the Files API download body straight to disk — never buffers. */
async function downloadFileToDisk(
  fileName: string,
  destPath: string,
): Promise<void> {
  const url = `${API_ROOT}/v1beta/${fileName}:download?alt=media`;
  const res = await fetch(url, { headers: { "x-goog-api-key": apiKey() } });
  if (!res.ok || !res.body) {
    const detail = res.body ? await res.text() : "<no body>";
    throw new Error(`download ${res.status}: ${detail}`);
  }
  await pipeline(
    Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(destPath, { highWaterMark: HIGH_WATER_MARK }),
  );
}

/**
 * Read the on-disk JSONL in chunks and run a tiny state machine over the
 * decoded text, in this order:
 *   1) find  "mimeType":"   → 2) capture chars up to closing "
 *   3) find  "data":"       → 4) capture base64 chars up to closing ",
 *      decoding into PCM in 4-char-aligned chunks as we go.
 *
 * Why this is safe without a real JSON parser:
 *   • The Gemini API never escapes characters inside the `mimeType` value
 *     (it's an audio MIME like "audio/L16;codec=pcm;rate=24000").
 *   • Base64 alphabet doesn't include '"' or '\\', so a literal '"'
 *     unambiguously terminates the data field.
 */
async function extractAudioToPcmFile(
  jsonlPath: string,
  pcmPath: string,
): Promise<{ mimeType: string; pcmBytes: number }> {
  const fh = await open(jsonlPath, "r");
  const reader = fh.createReadStream({ highWaterMark: HIGH_WATER_MARK });
  const out = createWriteStream(pcmPath, { highWaterMark: HIGH_WATER_MARK });
  const decoder = new TextDecoder();

  const NEEDLE_MIME = '"mimeType":"';
  const NEEDLE_DATA = '"data":"';

  type Mode =
    | "find_mime"
    | "capture_mime"
    | "find_data"
    | "capture_data"
    | "done";
  let mode: Mode = "find_mime";
  let pending = "";
  let mimeType = "";
  let base64Carry = "";
  let pcmBytes = 0;

  const writePcm = async (bytes: Buffer) => {
    pcmBytes += bytes.length;
    if (!out.write(bytes)) await once(out, "drain");
  };

  const flushBase64 = async (s: string, isFinal: boolean) => {
    const combined = base64Carry + s;
    const cut = isFinal
      ? combined.length
      : combined.length - (combined.length % 4);
    if (cut > 0) await writePcm(Buffer.from(combined.slice(0, cut), "base64"));
    base64Carry = isFinal ? "" : combined.slice(cut);
  };

  try {
    outer: for await (const chunk of reader) {
      pending += decoder.decode(chunk, { stream: true });
      while (true) {
        if (mode === "find_mime") {
          const i = pending.indexOf(NEEDLE_MIME);
          if (i === -1) {
            // keep enough tail that a needle straddling chunks is still
            // findable on the next iteration
            pending = pending.slice(-(NEEDLE_MIME.length - 1));
            break;
          }
          pending = pending.slice(i + NEEDLE_MIME.length);
          mode = "capture_mime";
        } else if (mode === "capture_mime") {
          const i = pending.indexOf('"');
          if (i === -1) {
            mimeType += pending;
            pending = "";
            break;
          }
          mimeType += pending.slice(0, i);
          pending = pending.slice(i + 1);
          mode = "find_data";
        } else if (mode === "find_data") {
          const i = pending.indexOf(NEEDLE_DATA);
          if (i === -1) {
            pending = pending.slice(-(NEEDLE_DATA.length - 1));
            break;
          }
          pending = pending.slice(i + NEEDLE_DATA.length);
          mode = "capture_data";
        } else if (mode === "capture_data") {
          const i = pending.indexOf('"');
          if (i === -1) {
            await flushBase64(pending, false);
            pending = "";
            break;
          }
          await flushBase64(pending.slice(0, i), true);
          pending = "";
          mode = "done";
          break outer;
        } else {
          break;
        }
      }
    }
    if (mode !== "done") {
      const size = (await stat(jsonlPath)).size;
      throw new Error(
        `inlineData.data not found in batch result (jsonl size=${size}). The batch line probably contains an error — open ${jsonlPath} to inspect.`,
      );
    }
  } finally {
    await fh.close();
    await new Promise<void>((resolve, reject) =>
      out.end((err?: unknown) => (err ? reject(err) : resolve())),
    );
  }

  return { mimeType, pcmBytes };
}

function parseSampleRate(mimeType: string): number {
  const m = mimeType.match(/rate=(\d+)/);
  return m ? Number.parseInt(m[1], 10) : 24000;
}

/** Write the 44-byte RIFF/WAVE header, then stream the PCM file in. */
async function writeWavFile(
  wavPath: string,
  pcmPath: string,
  pcmBytes: number,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
): Promise<void> {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBytes, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // format = PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBytes, 40);

  const out = createWriteStream(wavPath, { highWaterMark: HIGH_WATER_MARK });
  if (!out.write(header)) await once(out, "drain");

  const fh = await open(pcmPath, "r");
  try {
    await pipeline(
      fh.createReadStream({ highWaterMark: HIGH_WATER_MARK }),
      out,
    );
  } finally {
    await fh.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
