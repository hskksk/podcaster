/**
 * Memory-light client for Gemini TTS via the Batch API.
 *
 * Two design goals:
 *
 *   1. Don't block synchronously waiting for TTS. `submitBatchTts` uploads a
 *      tiny JSONL, creates a `batchGenerateContent` job, and returns a name
 *      the caller can persist. Polling and result fetch are independent
 *      calls — the caller can disconnect in between.
 *
 *   2. Never load the full audio onto the heap. `fetchBatchTtsAsWav`:
 *        - streams the result JSONL from the Files API straight to a temp
 *          file (no `.json()` / `.text()`),
 *        - single-pass-scans that file for `"mimeType":"…"` then `"data":"…"`,
 *        - decodes base64 in 4-char-aligned chunks straight into an on-disk
 *          `.pcm` file,
 *        - writes a 44-byte RIFF/WAVE header and pipes the PCM in.
 *      Peak resident memory ≈ `highWaterMark` (default 64 KiB), independent
 *      of audio length.
 *
 * REST endpoints used (auth via `x-goog-api-key`). The package talks to the
 * Gemini REST API directly via `fetch` — no `@google/genai` runtime
 * dependency, which keeps the install footprint small and lets us control
 * the streaming behaviour the SDK doesn't expose.
 *
 *   POST  /upload/v1beta/files                     (resumable upload)
 *   POST  /v1beta/models/{model}:batchGenerateContent
 *   GET   /v1beta/{batchName}
 *   GET   /v1beta/{fileName}:download?alt=media
 */

import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { once } from "node:events";

export interface GeminiBatchTtsEndpoints {
  /**
   * Files API resumable upload start. Receives no placeholders.
   * Default: `${apiRoot}/upload/${apiVersion}/files`.
   */
  upload?: string;
  /**
   * Batch create. `{model}` is replaced with the configured model id.
   * Default: `${apiRoot}/${apiVersion}/models/{model}:batchGenerateContent`.
   */
  batchCreate?: string;
  /**
   * Batch get. `{name}` is replaced with the batch resource name (e.g. `batches/abc`).
   * Default: `${apiRoot}/${apiVersion}/{name}`.
   */
  batchGet?: string;
  /**
   * Files API download. `{name}` is replaced with the file resource name (e.g. `files/xyz`).
   * Default: `${apiRoot}/${apiVersion}/{name}:download?alt=media`.
   */
  fileDownload?: string;
}

export interface GeminiBatchTtsClient {
  apiKey: string;
  /** Default `"gemini-3.1-flash-tts-preview"`. */
  model?: string;
  /** Default `"https://generativelanguage.googleapis.com"`. */
  apiRoot?: string;
  /** API version path segment. Default `"v1beta"`. */
  apiVersion?: string;
  /**
   * Per-route URL overrides. Anything not set falls back to the default
   * built from `apiRoot` + `apiVersion`. Useful for proxies, Vertex AI
   * endpoints, or staging hosts.
   */
  endpoints?: GeminiBatchTtsEndpoints;
  /** Read/write buffer size for the on-disk streams. Default `64 * 1024`. */
  highWaterMark?: number;
}

export interface Speaker {
  /** Name used as the `Speaker:` prefix in the script and in the TTS config. */
  name: string;
  /** Prebuilt voice id (e.g. `"Charon"`, `"Achird"`). */
  voice: string;
}

export interface SubmitBatchTtsParams {
  scriptText: string;
  host: Speaker;
  /** Omit for single-speaker output. */
  cohost?: Speaker;
  /** `display_name` for the batch job. Default `"podcast-tts"`. */
  displayName?: string;
  /** `key` field for the JSONL request line. Default `"tts-1"`. */
  requestKey?: string;
}

export interface SubmitBatchTtsResult {
  /** Resource name like `"batches/abc..."`. Pass to `getBatchStatus` / `fetchBatchTtsAsWav`. */
  batchName: string;
  /** Resource name of the uploaded input JSONL, like `"files/xyz..."`. */
  inputFile: string;
}

export interface BatchStatus {
  /** `"JOB_STATE_PENDING" | "JOB_STATE_RUNNING" | "JOB_STATE_SUCCEEDED" | "JOB_STATE_FAILED" | ...` */
  state: string;
  /** `"files/zzz..."` — only present once the job has succeeded. */
  output?: string;
  /** Populated when the job entered an error state. */
  error?: unknown;
}

export interface FetchBatchTtsAsWavParams {
  batchName: string;
  /** Destination `.wav` path. */
  outPath: string;
}

export interface FetchBatchTtsAsWavResult {
  pcmBytes: number;
  sampleRate: number;
  mimeType: string;
}

const DEFAULT_MODEL = "gemini-3.1-flash-tts-preview";
const DEFAULT_API_ROOT = "https://generativelanguage.googleapis.com";
const DEFAULT_API_VERSION = "v1beta";
const DEFAULT_HIGH_WATER_MARK = 64 * 1024;

interface ResolvedEndpoints {
  upload: string;
  batchCreate: string;
  batchGet: string;
  fileDownload: string;
}

function resolved(client: GeminiBatchTtsClient): {
  apiKey: string;
  model: string;
  apiRoot: string;
  apiVersion: string;
  endpoints: ResolvedEndpoints;
  highWaterMark: number;
} {
  if (!client.apiKey) throw new Error("GeminiBatchTtsClient: apiKey is required");
  const apiRoot = (client.apiRoot ?? DEFAULT_API_ROOT).replace(/\/+$/, "");
  const apiVersion = client.apiVersion ?? DEFAULT_API_VERSION;
  const ep = client.endpoints ?? {};
  return {
    apiKey: client.apiKey,
    model: client.model ?? DEFAULT_MODEL,
    apiRoot,
    apiVersion,
    endpoints: {
      upload: ep.upload ?? `${apiRoot}/upload/${apiVersion}/files`,
      batchCreate:
        ep.batchCreate ??
        `${apiRoot}/${apiVersion}/models/{model}:batchGenerateContent`,
      batchGet: ep.batchGet ?? `${apiRoot}/${apiVersion}/{name}`,
      fileDownload:
        ep.fileDownload ?? `${apiRoot}/${apiVersion}/{name}:download?alt=media`,
    },
    highWaterMark: client.highWaterMark ?? DEFAULT_HIGH_WATER_MARK,
  };
}

function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole,
  );
}

// ──────────────────────────────────────────────────────────────────────────
// submit: upload tiny JSONL → create batch job → return immediately
// ──────────────────────────────────────────────────────────────────────────

export async function submitBatchTts(
  client: GeminiBatchTtsClient,
  params: SubmitBatchTtsParams,
): Promise<SubmitBatchTtsResult> {
  const { apiKey, model, endpoints } = resolved(client);

  const speakerVoiceConfigs = [
    {
      speaker: params.host.name,
      voiceConfig: { prebuiltVoiceConfig: { voiceName: params.host.voice } },
    },
  ];
  if (params.cohost) {
    speakerVoiceConfigs.push({
      speaker: params.cohost.name,
      voiceConfig: { prebuiltVoiceConfig: { voiceName: params.cohost.voice } },
    });
  }

  const requestLine = JSON.stringify({
    key: params.requestKey ?? "tts-1",
    request: {
      contents: [{ role: "user", parts: [{ text: params.scriptText }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          multiSpeakerVoiceConfig: { speakerVoiceConfigs },
        },
      },
    },
  });
  const body = Buffer.from(requestLine + "\n", "utf8");

  const inputFile = await uploadJsonlFile(client, body, "tts-batch-input.jsonl");

  const res = await fetch(fillTemplate(endpoints.batchCreate, { model }), {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      batch: {
        display_name: params.displayName ?? "podcast-tts",
        input_config: { file_name: inputFile },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`batchGenerateContent ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { name?: string };
  if (!json.name) {
    throw new Error(`batch create returned no name: ${JSON.stringify(json)}`);
  }
  return { batchName: json.name, inputFile };
}

/**
 * Files API resumable upload (two-step). For TTS-batch input the bytes are a
 * few KB so we send them in one shot, but the protocol supports chunked
 * uploads for larger payloads.
 */
export async function uploadJsonlFile(
  client: GeminiBatchTtsClient,
  bytes: Buffer,
  displayName: string,
): Promise<string> {
  const { apiKey, endpoints } = resolved(client);

  const start = await fetch(endpoints.upload, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
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
  if (!name) {
    throw new Error(`upload finalize returned no file name: ${JSON.stringify(json)}`);
  }
  return name;
}

// ──────────────────────────────────────────────────────────────────────────
// status: cheap GET, no waiting
// ──────────────────────────────────────────────────────────────────────────

export async function getBatchStatus(
  client: GeminiBatchTtsClient,
  batchName: string,
): Promise<BatchStatus> {
  const { apiKey, endpoints } = resolved(client);
  const res = await fetch(fillTemplate(endpoints.batchGet, { name: batchName }), {
    headers: { "x-goog-api-key": apiKey },
  });
  if (!res.ok) {
    throw new Error(`batch get ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    metadata?: { state?: string };
    state?: string;
    responseFile?: string;
    response?: { dest?: { fileName?: string }; error?: unknown };
    dest?: { fileName?: string };
    metadataOutput?: { fileName?: string; file_name?: string; responseFile?: string };
    error?: unknown;
  };
  const rawState = json.metadata?.state ?? json.state ?? "UNKNOWN";
  const state = rawState.startsWith("BATCH_STATE_")
    ? `JOB_STATE_${rawState.slice("BATCH_STATE_".length)}`
    : rawState;
  const metadataOutput = (json as { metadata?: { output?: Record<string, unknown> } }).metadata?.output;
  const output =
    json.response?.dest?.fileName ??
    json.dest?.fileName ??
    json.responseFile ??
    (typeof metadataOutput?.fileName === "string" ? metadataOutput.fileName : undefined) ??
    (typeof metadataOutput?.file_name === "string" ? metadataOutput.file_name : undefined) ??
    (typeof metadataOutput?.responseFile === "string" ? metadataOutput.responseFile : undefined) ??
    (typeof metadataOutput?.responsesFile === "string" ? metadataOutput.responsesFile : undefined) ??
    undefined;
  const error = json.response?.error ?? json.error;
  return { state, ...(output ? { output } : {}), ...(error ? { error } : {}) };
}

// ──────────────────────────────────────────────────────────────────────────
// fetch: stream output JSONL → decode base64 chunked → WAV
// ──────────────────────────────────────────────────────────────────────────

export async function fetchBatchTtsAsWav(
  client: GeminiBatchTtsClient,
  params: FetchBatchTtsAsWavParams,
): Promise<FetchBatchTtsAsWavResult> {
  const status = await getBatchStatus(client, params.batchName);
  if (status.state !== "JOB_STATE_SUCCEEDED") {
    throw new Error(
      `batch not ready (state=${status.state})${
        status.error ? `: ${JSON.stringify(status.error)}` : ""
      }`,
    );
  }
  if (!status.output) throw new Error("batch SUCCEEDED but no output file name");

  const work = await mkdtemp(join(tmpdir(), "gemini-tts-"));
  const jsonlPath = join(work, "result.jsonl");
  const pcmPath = join(work, "audio.pcm");

  try {
    await downloadFileToDisk(client, status.output, jsonlPath);
    const { mimeType, pcmBytes } = await extractAudioToPcmFile(
      client,
      jsonlPath,
      pcmPath,
    );
    const sampleRate = parseSampleRate(mimeType);
    await writeWavFile(client, params.outPath, pcmPath, pcmBytes, sampleRate, 1, 16);
    return { pcmBytes, sampleRate, mimeType };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/** Stream the Files API download body straight to disk — never buffers. */
export async function downloadFileToDisk(
  client: GeminiBatchTtsClient,
  fileName: string,
  destPath: string,
): Promise<void> {
  const { apiKey, endpoints, highWaterMark } = resolved(client);
  const res = await fetch(
    fillTemplate(endpoints.fileDownload, { name: fileName }),
    { headers: { "x-goog-api-key": apiKey } },
  );
  if (!res.ok || !res.body) {
    const detail = res.body ? await res.text() : "<no body>";
    throw new Error(`download ${res.status}: ${detail}`);
  }
  await pipeline(
    Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(destPath, { highWaterMark }),
  );
}

/**
 * Read the on-disk JSONL in chunks and pull out `mimeType` + `data` from
 * `inlineData`. The two fields can appear in either order — Gemini emits
 * `{"data":"...","mimeType":"..."}` for TTS today — so the state machine
 * scans for whichever needle hits first, then looks for the other.
 *
 * Walk:
 *   scanning      → look for "mimeType":" or "data":", whichever is closer
 *   capture_mime  → copy chars up to closing "
 *   capture_data  → decode base64 chars up to closing ", in 4-char-aligned
 *                   chunks straight to the .pcm file
 *   done          → both fields captured; stop
 *
 * Why this is safe without a real JSON parser:
 *   • The Gemini API never escapes characters inside the `mimeType` value
 *     (it's an audio MIME like "audio/l16; rate=24000; channels=1").
 *   • Base64 alphabet doesn't include '"' or '\\', so a literal '"'
 *     unambiguously terminates the data field.
 *   • Both needles include the leading '"' on the key name, so common
 *     suffix collisions like `"some_data":"…"` don't false-match.
 */
export async function extractAudioToPcmFile(
  client: GeminiBatchTtsClient,
  jsonlPath: string,
  pcmPath: string,
): Promise<{ mimeType: string; pcmBytes: number }> {
  const { highWaterMark } = resolved(client);
  const reader = createReadStream(jsonlPath, { highWaterMark });
  const out = createWriteStream(pcmPath, { highWaterMark });
  const decoder = new TextDecoder();

  const NEEDLE_MIME = '"mimeType":"';
  const NEEDLE_DATA = '"data":"';
  const TAIL_KEEP = Math.max(NEEDLE_MIME.length, NEEDLE_DATA.length) - 1;

  type Mode = "scanning" | "capture_mime" | "capture_data" | "done";
  let mode: Mode = "scanning";
  let needMime = true;
  let needData = true;
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
      // Drain `pending` as far as the state machine can advance on what we
      // currently have, then go fetch the next chunk.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (mode === "scanning") {
          const mimeIdx = needMime ? pending.indexOf(NEEDLE_MIME) : -1;
          const dataIdx = needData ? pending.indexOf(NEEDLE_DATA) : -1;
          if (mimeIdx === -1 && dataIdx === -1) {
            // keep enough tail that a needle straddling chunks is still
            // findable on the next iteration
            if (pending.length > TAIL_KEEP) pending = pending.slice(-TAIL_KEEP);
            break;
          }
          const takeMime =
            mimeIdx !== -1 && (dataIdx === -1 || mimeIdx < dataIdx);
          if (takeMime) {
            pending = pending.slice(mimeIdx + NEEDLE_MIME.length);
            mode = "capture_mime";
          } else {
            pending = pending.slice(dataIdx + NEEDLE_DATA.length);
            mode = "capture_data";
          }
        } else if (mode === "capture_mime") {
          const i = pending.indexOf('"');
          if (i === -1) {
            mimeType += pending;
            pending = "";
            break;
          }
          mimeType += pending.slice(0, i);
          pending = pending.slice(i + 1);
          needMime = false;
          if (!needData) {
            mode = "done";
            break outer;
          }
          mode = "scanning";
        } else if (mode === "capture_data") {
          const i = pending.indexOf('"');
          if (i === -1) {
            await flushBase64(pending, false);
            pending = "";
            break;
          }
          await flushBase64(pending.slice(0, i), true);
          pending = pending.slice(i + 1);
          needData = false;
          if (!needMime) {
            mode = "done";
            break outer;
          }
          mode = "scanning";
        } else {
          break outer;
        }
      }
    }
    if (mode !== "done") {
      const size = (await stat(jsonlPath)).size;
      throw new Error(
        `inlineData.data / mimeType not both found in batch result ` +
          `(jsonl size=${size}, gotMime=${!needMime}, gotData=${!needData}). ` +
          `The batch line probably contains an error — open ${jsonlPath} to inspect.`,
      );
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      out.end((err?: unknown) => (err ? reject(err) : resolve())),
    );
  }

  return { mimeType, pcmBytes };
}

export function parseSampleRate(mimeType: string): number {
  const m = mimeType.match(/rate=(\d+)/);
  return m ? Number.parseInt(m[1], 10) : 24000;
}

/** Write the 44-byte RIFF/WAVE header, then stream the PCM file in. */
export async function writeWavFile(
  client: GeminiBatchTtsClient,
  wavPath: string,
  pcmPath: string,
  pcmBytes: number,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
): Promise<void> {
  const { highWaterMark } = resolved(client);
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

  const out = createWriteStream(wavPath, { highWaterMark });
  if (!out.write(header)) await once(out, "drain");
  await pipeline(createReadStream(pcmPath, { highWaterMark }), out);
}
