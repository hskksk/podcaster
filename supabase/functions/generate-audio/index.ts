import { GoogleGenAI } from "npm:@google/genai";
import { createSupabaseClient } from "../_shared/db.ts";
import { queueDelete, queueRead, queueSend } from "../_shared/queue.ts";
import { loadConfig } from "../_shared/config.ts";
import { writeLog } from "../_shared/logger.ts";

Deno.serve(async (_req) => {
  EdgeRuntime.waitUntil(processQueue());
  return Response.json({ ok: true });
});

function toJsonObject(value: unknown): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return { serialization_error: true };
  }
}

function extractTokenUsage(responseJson: Record<string, unknown>): Record<string, number | null> {
  const usage = (responseJson.usageMetadata ?? {}) as Record<string, unknown>;
  const readNumber = (key: string): number | null => {
    const v = usage[key];
    return typeof v === "number" ? v : null;
  };

  return {
    prompt_tokens: readNumber("promptTokenCount") ?? readNumber("inputTokenCount"),
    completion_tokens: readNumber("candidatesTokenCount") ?? readNumber("outputTokenCount"),
    total_tokens: readNumber("totalTokenCount"),
  };
}

function sanitizeAudioResponse(responseJson: Record<string, unknown>): Record<string, unknown> {
  const sanitized = structuredClone(responseJson) as Record<string, unknown>;
  const candidates = sanitized.candidates;
  if (!Array.isArray(candidates)) return sanitized;

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const content = (candidate as Record<string, unknown>).content;
    if (!content || typeof content !== "object") continue;
    const parts = (content as Record<string, unknown>).parts;
    if (!Array.isArray(parts)) continue;

    for (const part of parts) {
      if (!part || typeof part !== "object") continue;
      const inlineData = (part as Record<string, unknown>).inlineData;
      if (!inlineData || typeof inlineData !== "object") continue;
      const inlineDataRecord = inlineData as Record<string, unknown>;
      if (typeof inlineDataRecord.data === "string") {
        inlineDataRecord.byte_length = inlineDataRecord.data.length;
        delete inlineDataRecord.data;
      }
    }
  }

  return sanitized;
}

function pcmToWav(
  pcm: Uint8Array,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
): Uint8Array {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  write(36, "data");
  view.setUint32(40, dataSize, true);
  new Uint8Array(buffer, 44).set(pcm);
  return new Uint8Array(buffer);
}

async function processQueue(): Promise<void> {
  const db = createSupabaseClient();
  const msg = await queueRead(db, "audio-queue");
  if (!msg) return;

  const episodeId = msg.message.episode_id as string;
  const startMs = Date.now();
  let memNoteId: string | null = null;
  let script: { id: string; content: string } | null = null;

  try {
    const { data: scriptRow, error: scriptErr } = await db
      .from("scripts")
      .select("id, content, episodes(mem_note_id)")
      .eq("episode_id", episodeId)
      .eq("status", "ready")
      .single();
    if (scriptErr || !scriptRow) throw new Error(`Script not found for episode: ${episodeId}`);
    script = { id: scriptRow.id, content: scriptRow.content };
    memNoteId = (scriptRow.episodes as { mem_note_id?: string } | null)?.mem_note_id ?? null;

    const cfg = await loadConfig();
    const gemini = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY")! });

    const ttsModel = cfg["tts.model"] || "gemini-2.5-flash-preview-tts";
    const hostName = cfg["tts.host.name"] || "Host";
    const hostVoice = cfg["tts.host.voice"] || "Charon";
    const cohostName = cfg["tts.cohost.name"] || "CoHost";
    const cohostVoice = cfg["tts.cohost.voice"] || "Achird";
    const instructions = cfg["tts.instructions"];

    const scriptWithInstructions = instructions
      ? `${instructions}\n\n${script.content}`
      : script.content;

    const response = await gemini.models.generateContent({
      model: ttsModel,
      contents: [{ role: "user", parts: [{ text: scriptWithInstructions }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: hostName,
                voiceConfig: { prebuiltVoiceConfig: { voiceName: hostVoice } },
              },
              {
                speaker: cohostName,
                voiceConfig: { prebuiltVoiceConfig: { voiceName: cohostVoice } },
              },
            ],
          },
        },
      },
    });

    const responseJson = toJsonObject(response);
    const tokenUsage = extractTokenUsage(responseJson);
    const sanitizedResponse = sanitizeAudioResponse(responseJson);

    const audioPart = response.candidates?.[0]?.content?.parts?.[0];
    if (!audioPart?.inlineData?.data) {
      throw new Error("No audio data in Gemini TTS response");
    }

    const rawMime = audioPart.inlineData.mimeType || "audio/wav";
    console.log("TTS MIME type:", rawMime);

    const pcmBytes = Uint8Array.from(
      atob(audioPart.inlineData.data),
      (c) => c.charCodeAt(0),
    );

    // Convert raw PCM (L16/L24) to WAV by prepending RIFF/WAV header
    let audioBytes: Uint8Array;
    let uploadMime: string;
    if (rawMime.includes("L16") || rawMime.includes("pcm") || rawMime.includes("raw")) {
      const sampleRateMatch = rawMime.match(/rate=(\d+)/);
      const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1]) : 24000;
      audioBytes = pcmToWav(pcmBytes, sampleRate, 1, 16);
      uploadMime = "audio/wav";
    } else {
      audioBytes = pcmBytes;
      uploadMime = rawMime.includes("mp4") ? "audio/mp4"
        : rawMime.includes("mpeg") ? "audio/mpeg"
        : "audio/wav";
    }

    const ext = uploadMime === "audio/mp4" ? "m4a"
      : uploadMime === "audio/mpeg" ? "mp3"
      : "wav";

    const audioPath = `audio/${episodeId}.${ext}`;

    // Wrap in Blob for reliable large-file upload in Deno Edge Runtime
    const audioBlob = new Blob([audioBytes], { type: uploadMime });
    const { error: uploadErr } = await db.storage
      .from("podcast")
      .upload(audioPath, audioBlob, {
        contentType: uploadMime,
        upsert: true,
        cacheControl: "31536000",
      });
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    await db.from("audio_files").insert({
      episode_id: episodeId,
      script_id: script.id,
      storage_path: audioPath,
      mime_type: uploadMime,
      status: "ready",
      llm_usage: tokenUsage,
      llm_response: sanitizedResponse,
    });
    await db.from("episodes").update({ status: "audio_ready" }).eq("id", episodeId);

    await queueSend(db, "rss-queue", { episode_id: episodeId });
    await queueDelete(db, "audio-queue", msg.msg_id);
    await writeLog(db, {
      queue_name: "audio-queue",
      message_id: msg.msg_id,
      episode_id: episodeId,
      mem_note_id: memNoteId,
      status: "success",
      duration_ms: Date.now() - startMs,
    });
    console.log(`Audio generated for episode ${episodeId}: ${audioPath}`);
  } catch (err) {
    console.error(`generate-audio failed for episode ${episodeId}:`, err);
    await db.from("audio_files").insert({
      episode_id: episodeId,
      script_id: script?.id ?? null,
      storage_path: "",
      mime_type: "",
      status: "failed",
      error: String(err),
      llm_usage: {},
      llm_response: { error: String(err) },
    });
    await db.from("episodes").update({ status: "failed" }).eq("id", episodeId);
    await queueDelete(db, "audio-queue", msg.msg_id);
    await writeLog(db, {
      queue_name: "audio-queue",
      message_id: msg.msg_id,
      episode_id: episodeId,
      mem_note_id: memNoteId,
      status: "failure",
      error_message: String(err),
      duration_ms: Date.now() - startMs,
    });
  }
}
