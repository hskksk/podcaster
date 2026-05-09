/**
 * CLI for @podcaster/gemini-batch-tts.
 *
 * Run via the package script:
 *   pnpm --filter @podcaster/gemini-batch-tts cli submit "<script>"
 *   pnpm --filter @podcaster/gemini-batch-tts cli status <batchName>
 *   pnpm --filter @podcaster/gemini-batch-tts cli fetch  <batchName> [out.wav]
 *
 * Or from inside the package directory:
 *   pnpm cli submit "<script>"
 *
 * Required env: GEMINI_API_KEY
 * Optional env: GEMINI_TTS_MODEL, GEMINI_TTS_HOST_NAME, GEMINI_TTS_HOST_VOICE,
 *               GEMINI_TTS_COHOST_NAME, GEMINI_TTS_COHOST_VOICE
 */

import {
  fetchBatchTtsAsWav,
  getBatchStatus,
  submitBatchTts,
  type GeminiBatchTtsClient,
} from "./index.ts";

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
      '  pnpm cli submit "<script>"',
      "  pnpm cli status <batchName>",
      "  pnpm cli fetch  <batchName> [out.wav]",
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
