import { GoogleGenAI, ThinkingLevel } from "npm:@google/genai";
import { createSupabaseClient } from "../_shared/db.ts";
import { queueDelete, queueRead, queueSend } from "../_shared/queue.ts";
import { loadConfig } from "../_shared/config.ts";
import { writeLog } from "../_shared/logger.ts";
import {
  DEFAULT_SYSTEM_INSTRUCTION,
  DEFAULT_USER_PROMPT_TEMPLATE,
  generateScriptFromArticle,
} from "../../../shared/script-generation.ts";

Deno.serve(async (_req) => {
  EdgeRuntime.waitUntil(processQueue());
  return Response.json({ ok: true });
});

async function processQueue(): Promise<void> {
  const db = createSupabaseClient();
  const msg = await queueRead(db, "script-queue");
  if (!msg) return;

  const articleId = msg.message.article_id as string;
  const regenerate = msg.message.regenerate === true;
  const targetEpisodeId = typeof msg.message.target_episode_id === "string"
    ? msg.message.target_episode_id
    : null;
  const startMs = Date.now();
  let memNoteId: string | null = null;
  let episodeIdForLog: string | null = null;

  try {
    const { data: article, error: fetchErr } = await db
      .from("articles")
      .select("content, mem_note_id")
      .eq("id", articleId)
      .single();
    if (fetchErr || !article) throw new Error(`Article not found: ${articleId}`);
    memNoteId = article.mem_note_id ?? null;

    const cfg = await loadConfig();
    const gemini = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY")! });

    const systemInstruction = cfg["generator.system_instruction"] as string || DEFAULT_SYSTEM_INSTRUCTION;
    const promptTemplate = cfg["generator.prompt_template"] as string || DEFAULT_USER_PROMPT_TEMPLATE;

    const generated = await generateScriptFromArticle({
      articleContent: article.content,
      model: cfg["generator.model"] || "gemini-2.5-flash",
      systemInstruction,
      promptTemplate,
      thinkingLevel: ThinkingLevel.HIGH,
      generateContent: (params) => gemini.models.generateContent(params),
    });
    console.log("LLM raw response (first 300 chars):", generated.rawText.slice(0, 300));

    let episodeId: string;
    if (regenerate) {
      if (!targetEpisodeId) throw new Error("target_episode_id is required for regenerate script");
      const { data: targetEpisode, error: targetErr } = await db
        .from("episodes")
        .select("id, article_id")
        .eq("id", targetEpisodeId)
        .maybeSingle();
      if (targetErr || !targetEpisode) throw new Error(`Episode not found: ${targetEpisodeId}`);
      if (targetEpisode.article_id !== articleId) {
        throw new Error(`Episode ${targetEpisodeId} does not belong to article ${articleId}`);
      }

      const { error: updateErr } = await db
        .from("episodes")
        .update({
          title: generated.title.slice(0, 20),
          description: generated.description.slice(0, 100),
          status: "script_ready",
        })
        .eq("id", targetEpisodeId);
      if (updateErr) throw new Error(`Episode update failed: ${updateErr.message}`);
      episodeId = targetEpisodeId;
    } else {
      const { data: episode, error: insertErr } = await db
        .from("episodes")
        .insert({
          article_id: articleId,
          mem_note_id: memNoteId,
          title: generated.title.slice(0, 20),
          description: generated.description.slice(0, 100),
          status: "script_ready",
        })
        .select("id")
        .single();
      if (insertErr || !episode) throw new Error(`Episode insert failed: ${insertErr?.message}`);
      episodeId = episode.id;
    }
    episodeIdForLog = episodeId;

    await db.from("scripts").insert({
      episode_id: episodeId,
      content: generated.script,
      status: "ready",
      llm_usage: generated.tokenUsage,
      llm_response: generated.responseJson,
    });

    await queueSend(
      db,
      "audio-queue",
      regenerate ? { episode_id: episodeId, regenerate: true } : { episode_id: episodeId },
    );
    await queueDelete(db, "script-queue", msg.msg_id);
    await writeLog(db, {
      queue_name: "script-queue",
      message_id: msg.msg_id,
      article_id: articleId,
      episode_id: episodeId,
      mem_note_id: memNoteId,
      status: "success",
      duration_ms: Date.now() - startMs,
    });
    console.log(`Script generated for article ${articleId}, episode ${episodeId}`);
  } catch (err) {
    console.error(`generate-script failed for article ${articleId}:`, err);
    if (regenerate && targetEpisodeId) {
      episodeIdForLog = targetEpisodeId;
      await db.from("scripts").insert({
        episode_id: targetEpisodeId,
        content: "",
        status: "failed",
        error: String(err),
        llm_usage: {},
        llm_response: { error: String(err), regenerate: true },
      });
    } else {
      const { data: failedEpisode } = await db
        .from("episodes")
        .insert({
          article_id: articleId,
          mem_note_id: memNoteId,
          title: "Error",
          description: "",
          status: "failed",
        })
        .select("id")
        .single();
      if (failedEpisode) {
        episodeIdForLog = failedEpisode.id;
        await db.from("scripts").insert({
          episode_id: failedEpisode.id,
          content: "",
          status: "failed",
          error: String(err),
          llm_usage: {},
          llm_response: { error: String(err) },
        });
      }
    }
    await queueDelete(db, "script-queue", msg.msg_id);
    await writeLog(db, {
      queue_name: "script-queue",
      message_id: msg.msg_id,
      article_id: articleId,
      ...(episodeIdForLog ? { episode_id: episodeIdForLog } : {}),
      mem_note_id: memNoteId,
      status: "failure",
      error_message: String(err),
      duration_ms: Date.now() - startMs,
    });
  }
}
