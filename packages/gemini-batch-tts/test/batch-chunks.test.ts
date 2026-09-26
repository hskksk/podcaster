/**
 * Multi-request batches: submit keys the JSONL per chunk; fetch orders the
 * records by key (the API does not guarantee output order), and reports which
 * chunk has no audio.
 *
 * Run with: node --experimental-strip-types packages/gemini-batch-tts/test/batch-chunks.test.ts
 * (no install needed; uses only Node built-ins. `fetch` is stubbed.)
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { fetchBatchTtsAsWav, indexJsonlRecords, submitBatchTts } from "../src/index.ts";

const MIME = "audio/l16; rate=24000; channels=1";

/** One output record like the real API: `key` written AFTER the audio payload. */
function audioRecord(key: string, fill: number, keyFirst = false): string {
  const response = {
    candidates: [
      { content: { role: "model", parts: [{ inlineData: { data: Buffer.alloc(300, fill).toString("base64"), mimeType: MIME } }] }, index: 0, finishReason: "STOP" },
    ],
    usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 82, totalTokenCount: 94 },
    modelVersion: "gemini-3.1-flash-tts-preview",
  };
  return JSON.stringify(keyFirst ? { key, response } : { response, key });
}

let uploaded = "";
let outputJsonl = "";
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  if (url.endsWith("/upload/v1beta/files")) {
    return new Response("{}", { headers: { "x-goog-upload-url": "http://stub/upload-target" } });
  }
  if (url === "http://stub/upload-target") {
    uploaded = Buffer.from(init!.body as Uint8Array).toString("utf8");
    return Response.json({ file: { name: "files/in" } });
  }
  if (url.endsWith(":batchGenerateContent")) return Response.json({ name: "batches/b1" });
  if (url.endsWith("/batches/b1")) {
    return Response.json({ metadata: { state: "BATCH_STATE_SUCCEEDED" }, response: { dest: { fileName: "files/out" } } });
  }
  if (url.includes("/files/out:download")) return new Response(outputJsonl);
  throw new Error(`unexpected fetch ${url}`);
}) as typeof fetch;

// tiny highWaterMark: keys, needles and record boundaries straddle read chunks
const client = { apiKey: "x", apiRoot: "http://stub", highWaterMark: 17 };
const work = mkdtempSync(join(tmpdir(), "gemini-tts-chunks-"));

function readWavData(path: string): Buffer {
  const wav = readFileSync(path);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.readUInt32LE(24), 24000);
  const dataBytes = wav.readUInt32LE(40);
  assert.equal(wav.length, 44 + dataBytes);
  return wav.subarray(44);
}

// ── submit: one JSONL line per chunk, zero-padded keys in chunk order ──────
{
  const res = await submitBatchTts(client, {
    scriptText: ["Host: 一つ目", "CoHost: 二つ目", "Host: 三つ目"],
    host: { name: "Host", voice: "Fenrir" },
    cohost: { name: "CoHost", voice: "Kore" },
    requestKey: "script-x",
  });
  assert.equal(res.requestCount, 3);
  const lines = uploaded.trimEnd().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.key), ["script-x-0001", "script-x-0002", "script-x-0003"]);
  assert.deepEqual(lines.map((l) => l.request.contents[0].parts[0].text), ["Host: 一つ目", "CoHost: 二つ目", "Host: 三つ目"]);
  assert.equal(lines[0].request.generationConfig.speechConfig.multiSpeakerVoiceConfig.speakerVoiceConfigs.length, 2);
}

// ── submit: a plain string keeps the old single-request shape ──────────────
{
  const res = await submitBatchTts(client, {
    scriptText: "Host: こんにちは",
    host: { name: "Host", voice: "Fenrir" },
    requestKey: "script-x",
  });
  assert.equal(res.requestCount, 1);
  assert.deepEqual(uploaded.trimEnd().split("\n").map((l) => JSON.parse(l).key), ["script-x"]);
}

// ── index: keys found whether they precede or follow the payload ───────────
{
  const p = join(work, "index.jsonl");
  const { writeFileSync } = await import("node:fs");
  const text = [audioRecord("a", 1), "", audioRecord("b", 2, true), `{"error":{"code":500}}`].join("\n") + "\n";
  writeFileSync(p, text);
  const recs = await indexJsonlRecords(p, 17);
  assert.deepEqual(recs.map((r) => r.key), ["a", "b", "line-2"]);
  const buf = Buffer.from(text);
  for (const r of recs) assert.equal(buf[r.end + 1], 0x0a, "record ends right before a newline");
  assert.ok(buf.subarray(recs[0].start, recs[0].end + 1).toString().startsWith('{"response"'));
}

// ── fetch: records written out of order come back in key order ─────────────
{
  outputJsonl = [audioRecord("k-0003", 3), audioRecord("k-0001", 1), audioRecord("k-0002", 2, true)].join("\n") + "\n";
  const out = join(work, "ordered.wav");
  const res = await fetchBatchTtsAsWav(client, { batchName: "batches/b1", outPath: out, expectedCount: 3 });
  assert.equal(res.chunkCount, 3);
  assert.equal(res.pcmBytes, 900);
  assert.equal(res.sampleRate, 24000);
  const pcm = readWavData(out);
  assert.ok(pcm.subarray(0, 300).every((b) => b === 1));
  assert.ok(pcm.subarray(300, 600).every((b) => b === 2));
  assert.ok(pcm.subarray(600, 900).every((b) => b === 3));
}

// ── fetch: legacy single record without a key still works ──────────────────
{
  outputJsonl = JSON.stringify({ response: JSON.parse(audioRecord("x", 7)).response }) + "\n";
  const out = join(work, "legacy.wav");
  const res = await fetchBatchTtsAsWav(client, { batchName: "batches/b1", outPath: out });
  assert.equal(res.chunkCount, 1);
  assert.ok(readWavData(out).every((b) => b === 7));
}

// ── fetch: a chunk without audio names the chunk and the API error ─────────
{
  outputJsonl = [audioRecord("k-0001", 1), JSON.stringify({ key: "k-0002", error: { code: 500, message: "boom" } }), audioRecord("k-0003", 3)].join("\n") + "\n";
  await assert.rejects(
    fetchBatchTtsAsWav(client, { batchName: "batches/b1", outPath: join(work, "err.wav") }),
    (err: Error) => {
      assert.match(err.message, /chunk 2\/3 \(key=k-0002\) has no audio/);
      assert.match(err.message, /boom/);
      return true;
    },
  );
}

// ── fetch: wrong record count / duplicate keys are rejected ────────────────
{
  outputJsonl = [audioRecord("k-0001", 1), audioRecord("k-0002", 2)].join("\n") + "\n";
  await assert.rejects(
    fetchBatchTtsAsWav(client, { batchName: "batches/b1", outPath: join(work, "n.wav"), expectedCount: 3 }),
    /2 record\(s\), expected 3/,
  );
  outputJsonl = [audioRecord("k-0001", 1), audioRecord("k-0001", 2)].join("\n") + "\n";
  await assert.rejects(
    fetchBatchTtsAsWav(client, { batchName: "batches/b1", outPath: join(work, "d.wav") }),
    /duplicate keys/,
  );
}

globalThis.fetch = realFetch;
console.log("batch-chunks: all assertions passed");
