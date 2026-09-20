/**
 * Run with: node --experimental-strip-types shared/tts-prompt.test.ts
 * (no install needed; uses only Node built-ins.)
 */

import assert from "node:assert/strict";
import { buildTtsPrompt, splitTranscriptIntoChunks, TTS_TRANSCRIPT_MARKER } from "./tts-prompt.ts";

const transcript = "Host: こんにちは。\nCoHost: よろしくお願いします。";
const host = { name: "Host", tone: "明るく元気でテンポの良い進行" };
const cohost = { name: "CoHost", tone: "若々しくフレッシュな受け答え" };

/** The marker is also quoted in the preamble; the real delimiter is the one followed by a newline. */
function splitPrompt(prompt: string): [direction: string, spoken: string] {
  const i = prompt.lastIndexOf(`${TTS_TRANSCRIPT_MARKER}\n`);
  assert.ok(i >= 0, "delimiter present");
  return [prompt.slice(0, i), prompt.slice(i + TTS_TRANSCRIPT_MARKER.length + 1)];
}

// direction sits above the marker, transcript is verbatim below it
{
  const prompt = buildTtsPrompt({ instructions: "ポッドキャストの会話です。", host, cohost, transcript });
  const [direction, spoken] = splitPrompt(prompt);
  assert.equal(spoken, transcript);
  assert.match(direction, /must NOT be spoken/);
  assert.match(direction, /- Host: 明るく元気でテンポの良い進行/);
  assert.match(direction, /- CoHost: 若々しくフレッシュな受け答え/);
  assert.match(direction, /## SCENE\nポッドキャストの会話です。/);
  // no tone text leaks into the spoken part
  assert.ok(!spoken.includes("明るく元気"));
}

// blank / missing instructions drop the SCENE section
for (const instructions of [undefined, null, "", "  \n "]) {
  const prompt = buildTtsPrompt({ instructions, host, cohost, transcript });
  assert.ok(!prompt.includes("## SCENE"));
  assert.ok(prompt.endsWith(`${TTS_TRANSCRIPT_MARKER}\n${transcript}`));
}

// single speaker: no cohost line
{
  const [direction] = splitPrompt(buildTtsPrompt({ host, transcript: "Host: こんにちは。" }));
  assert.match(direction, /- Host: /);
  assert.ok(!direction.includes("CoHost"));
}

// the fixed direction stays affirmative (cookbook#1292: dampening words cause drift)
{
  const [direction] = splitPrompt(buildTtsPrompt({ host, cohost, transcript }));
  for (const word of ["quiet", "flat", "monotone", "no rush", "whisper", "relaxed", "fade"]) {
    assert.ok(!direction.toLowerCase().includes(word), `direction must not contain "${word}"`);
  }
}

// ── splitTranscriptIntoChunks ──────────────────────────────────────────────
const speakerNames = ["Host", "CoHost"];
const turn = (who: string, n: number) => `${who}: ${"あ".repeat(n - who.length - 2)}`; // exactly n chars

// short script stays one chunk, content unchanged
{
  const script = [turn("Host", 100), turn("CoHost", 100)].join("\n");
  assert.deepEqual(splitTranscriptIntoChunks(script, { maxChars: 800, speakerNames }), [script]);
}

// splits only at turn boundaries, in order, respecting maxChars, no text lost
{
  const turns = Array.from({ length: 10 }, (_, i) => turn(i % 2 ? "CoHost" : "Host", 300));
  const chunks = splitTranscriptIntoChunks(turns.join("\n"), { maxChars: 800, speakerNames });
  assert.deepEqual(chunks.map((c) => c.split("\n").length), [2, 2, 2, 2, 2]);
  assert.equal(chunks.join("\n"), turns.join("\n"));
  for (const c of chunks) assert.ok(c.startsWith("Host:") || c.startsWith("CoHost:"));
  for (const c of chunks) assert.ok(c.length <= 800 + 1); // + the joining newline
}

// an over-long single turn is never cut
{
  const long = turn("Host", 2000);
  assert.deepEqual(splitTranscriptIntoChunks(long, { maxChars: 800, speakerNames }), [long]);
}

// unlabeled lines continue the previous turn; blank lines are dropped
{
  const script = `${turn("Host", 500)}\n続きの行です。\n\n${turn("CoHost", 500)}`;
  const chunks = splitTranscriptIntoChunks(script, { maxChars: 800, speakerNames });
  assert.equal(chunks.length, 2);
  assert.ok(chunks[0].endsWith("\n続きの行です。"));
  assert.ok(chunks[1].startsWith("CoHost:"));
}

// a tiny trailing chunk is merged back when it fits
{
  const script = [turn("Host", 700), turn("CoHost", 700), turn("Host", 40)].join("\n");
  const chunks = splitTranscriptIntoChunks(script, { maxChars: 800, speakerNames });
  assert.equal(chunks.length, 2);
  assert.ok(chunks[1].split("\n").length === 2);
}

// full-width colon labels are recognised too
{
  const script = "Host：こんにちは\nCoHost：どうも";
  assert.deepEqual(splitTranscriptIntoChunks(script, { maxChars: 10, speakerNames }), ["Host：こんにちは", "CoHost：どうも"]);
}

console.log("tts-prompt: all assertions passed");
