/**
 * CLI for the memory-light Gemini Batch TTS client.
 *
 * The actual implementation lives in `scripts/lib/gemini-batch-tts.ts` so
 * other scripts can import it programmatically. This file just maps argv to
 * those library calls.
 *
 * Usage
 * -----
 *   GEMINI_API_KEY=... npx tsx scripts/gemini-tts-file-download.ts \
 *     submit "Host: こんにちは。\nCoHost: 今日もよろしく。"
 *   # → {"batch":"batches/xxx","inputFile":"files/yyy"}
 *
 *   npx tsx scripts/gemini-tts-file-download.ts status batches/xxx
 *   # → {"state":"JOB_STATE_RUNNING"}
 *   # → {"state":"JOB_STATE_SUCCEEDED","output":"files/zzz"}
 *
 *   npx tsx scripts/gemini-tts-file-download.ts fetch batches/xxx out.wav
 *   # → {"out":"out.wav","pcmBytes":...,"sampleRate":24000,"mimeType":"...","rssMiB":...}
 */

import {
  fetchBatchTtsAsWav,
  getBatchStatus,
  submitBatchTts,
  type GeminiBatchTtsClient,
} from "./lib/gemini-batch-tts.ts";

function buildClient(): GeminiBatchTtsClient {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return {
    apiKey,
    model: process.env.GEMINI_TTS_MODEL,
  };
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

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  const client = buildClient();

  if (cmd === "submit") {
    const [scriptText] = rest;
    if (!scriptText) usage();
    const result = await submitBatchTts(client, {
      scriptText,
      host: {
        name: process.env.GEMINI_TTS_HOST_NAME ?? "Host",
        voice: process.env.GEMINI_TTS_HOST_VOICE ?? "Charon",
      },
      cohost: {
        name: process.env.GEMINI_TTS_COHOST_NAME ?? "CoHost",
        voice: process.env.GEMINI_TTS_COHOST_VOICE ?? "Achird",
      },
    });
    console.log(JSON.stringify({ batch: result.batchName, inputFile: result.inputFile }));
  } else if (cmd === "status") {
    const [batchName] = rest;
    if (!batchName) usage();
    console.log(JSON.stringify(await getBatchStatus(client, batchName)));
  } else if (cmd === "fetch") {
    const [batchName, outPath = "out.wav"] = rest;
    if (!batchName) usage();
    const result = await fetchBatchTtsAsWav(client, { batchName, outPath });
    const rss = process.memoryUsage().rss;
    console.log(
      JSON.stringify({
        out: outPath,
        pcmBytes: result.pcmBytes,
        sampleRate: result.sampleRate,
        mimeType: result.mimeType,
        rssMiB: +(rss / 1024 / 1024).toFixed(1),
      }),
    );
  } else {
    usage();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
