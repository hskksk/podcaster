/**
 * Prompt builder for Gemini 3.1 Flash TTS (multi-speaker podcast).
 *
 * Structure follows the official "director's notes" layout, plus three rules for
 * long (5+ min) episodes:
 *
 *  1. Everything that is direction only sits above an explicit
 *     `#### TRANSCRIPT` delimiter, and the preamble says the direction must not
 *     be spoken. Without the delimiter the model can read stage directions aloud.
 *  2. Long scripts are split into chunks (`splitTranscriptIntoChunks`), one TTS
 *     request each. 3.1 drifts within a single long generation whatever the
 *     prompt says (current wording, new structure and affirmative tones all fade
 *     6-10 dB over ~8 min). Chunking reduces it but does not remove it — see
 *     DEFAULT_TTS_CHUNK_MAX_CHARS.
 *  3. Direction is phrased affirmatively. cookbook#1292 blames dampening words
 *     ("quiet", "flat", "relaxed", "no rush", …) for the fade; we could not
 *     reproduce that as the cause, but the notes ask for constant volume and
 *     energy anyway (higher starting level, no downside), and per-speaker tone
 *     strings are passed through as-is.
 */

export interface TtsSpeakerDirection {
  name: string;
  tone: string;
}

export interface BuildTtsPromptInput {
  /** Free-form scene / situation text (`tts.instructions`). */
  instructions?: string | null;
  host: TtsSpeakerDirection;
  /** Omit for single-speaker output. */
  cohost?: TtsSpeakerDirection;
  /** The dialogue script (`Host: …\nCoHost: …`). */
  transcript: string;
}

export const TTS_TRANSCRIPT_MARKER = "#### TRANSCRIPT";

const PREAMBLE =
  "Synthesize speech for the performance defined below. " +
  "The AUDIO PROFILE, SCENE and DIRECTOR'S NOTES sections are direction only and must NOT be spoken. " +
  `Speak only the text after "${TTS_TRANSCRIPT_MARKER}", and do not read the speaker labels aloud.`;

const DIRECTOR_NOTES = [
  "- Consistency: Deliver every line at the same clear, full volume and energy, from the first line to the last line of the episode.",
  "- Articulation: Crisp, well-enunciated speech with natural conversational tempo and a short natural pause at each change of speaker.",
];

export function buildTtsPrompt(input: BuildTtsPromptInput): string {
  const speakers = [input.host, input.cohost].filter(
    (s): s is TtsSpeakerDirection => s !== undefined,
  );

  const sections = [
    PREAMBLE,
    ["## AUDIO PROFILE", ...speakers.map((s) => `- ${s.name}: ${s.tone}`)].join("\n"),
  ];

  const scene = input.instructions?.trim();
  if (scene) sections.push(`## SCENE\n${scene}`);

  sections.push(["## DIRECTOR'S NOTES", ...DIRECTOR_NOTES].join("\n"));
  sections.push(`${TTS_TRANSCRIPT_MARKER}\n${input.transcript}`);

  return sections.join("\n\n");
}

/**
 * Gemini 3.1 Flash TTS loses ~5-6 dB within the first minute or so of a single
 * generation and keeps sliding for the rest of it (measured on a ~8 min script;
 * the same script on 2.5 Flash stays flat and ~8 dB louder). Splitting at
 * speaker-turn boundaries into ~2 min chunks resets the slide: level of the last
 * quarter of the episode -23…-26 dB vs -28…-31 dB for one request, worst 30 s
 * window -27…-29 dB vs -30…-33 dB. Each chunk still decays a few dB after its
 * loud start, so the episode is not flat (2 runs each; not tuned further).
 * ~7 chars/s of Japanese speech → 800 chars ≈ 2 min.
 */
export const DEFAULT_TTS_CHUNK_MAX_CHARS = 800;

/**
 * Split a `Speaker: text` script into chunks of at most `maxChars`, breaking
 * only between speaker turns so every chunk starts with a speaker label (which
 * multi-speaker TTS requires). A turn longer than `maxChars` stays whole, and a
 * very short trailing chunk is merged back into the previous one.
 * Lines without a known speaker label continue the previous turn.
 */
export function splitTranscriptIntoChunks(
  transcript: string,
  opts: { maxChars: number; speakerNames: readonly string[] },
): string[] {
  const { maxChars, speakerNames } = opts;
  const startsTurn = (line: string) =>
    speakerNames.some((n) => line.startsWith(`${n}:`) || line.startsWith(`${n}：`));

  const turns: string[] = [];
  for (const raw of transcript.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (turns.length === 0 || startsTurn(line)) turns.push(line);
    else turns[turns.length - 1] += `\n${line}`;
  }

  const chunks: string[][] = [];
  let size = 0;
  for (const turn of turns) {
    const last = chunks[chunks.length - 1];
    if (last && size + turn.length <= maxChars) {
      last.push(turn);
      size += turn.length;
    } else {
      chunks.push([turn]);
      size = turn.length;
    }
  }

  const lengthOf = (c: string[]) => c.reduce((n, t) => n + t.length, 0);
  if (chunks.length >= 2) {
    const tail = chunks[chunks.length - 1];
    const prev = chunks[chunks.length - 2];
    if (lengthOf(tail) < maxChars / 4 && lengthOf(prev) + lengthOf(tail) <= maxChars * 1.5) {
      prev.push(...chunks.pop()!);
    }
  }
  return chunks.map((c) => c.join("\n"));
}
