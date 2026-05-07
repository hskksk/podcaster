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

  const regenerate = msg.message.regenerate === true;
  const messageEpisodeId = typeof msg.message.episode_id === "string"
    ? msg.message.episode_id
    : null;
  const legacyTargetEpisodeId = typeof msg.message.target_episode_id === "string"
    ? msg.message.target_episode_id
    : null;
  const legacyArticleId = typeof msg.message.article_id === "string" ? msg.message.article_id : null;
  const startMs = Date.now();
  let memNoteId: string | null = null;
  let episodeIdForLog: string | null = null;
  let articleIdForLog: string | null = legacyArticleId;

  try {
    let episodeId = messageEpisodeId ?? legacyTargetEpisodeId;

    if (!episodeId && legacyArticleId) {
      const { data: existingEpisode } = await db
        .from("episodes")
        .select("id")
        .eq("article_id", legacyArticleId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingEpisode) {
        episodeId = existingEpisode.id;
      } else {
        const { data: articleForLegacy, error: legacyFetchErr } = await db
          .from("articles")
          .select("id, title, mem_note_id")
          .eq("id", legacyArticleId)
          .maybeSingle();
        if (legacyFetchErr || !articleForLegacy) {
          throw new Error(`Article not found for legacy script-queue payload: ${legacyArticleId}`);
        }
        const { data: createdEpisode, error: createEpisodeErr } = await db
          .from("episodes")
          .insert({
            article_id: articleForLegacy.id,
            mem_note_id: articleForLegacy.mem_note_id ?? null,
            title: (articleForLegacy.title || "Untitled").slice(0, 20),
            description: "",
            status: "ingested",
          })
          .select("id")
          .single();
        if (createEpisodeErr || !createdEpisode) {
          throw new Error(`Failed to create episode for legacy payload: ${createEpisodeErr?.message}`);
        }
        episodeId = createdEpisode.id;
      }
    }

    if (!episodeId) {
      throw new Error("episode_id is required for script-queue message");
    }

    const { data: episode, error: episodeErr } = await db
      .from("episodes")
      .select("id, article_id, mem_note_id")
      .eq("id", episodeId)
      .maybeSingle();
    if (episodeErr || !episode) throw new Error(`Episode not found: ${episodeId}`);
    if (!episode.article_id) throw new Error(`Episode ${episodeId} has no article_id`);
    episodeIdForLog = episode.id;
    articleIdForLog = episode.article_id;

    const { data: article, error: fetchErr } = await db
      .from("articles")
      .select("content, mem_note_id")
      .eq("id", episode.article_id)
      .single();
    if (fetchErr || !article) throw new Error(`Article not found: ${episode.article_id}`);
    memNoteId = episode.mem_note_id ?? article.mem_note_id ?? null;

    const { error: runningErr } = await db
      .from("episodes")
      .update({ status: "script_running" })
      .eq("id", episode.id);
    if (runningErr) throw new Error(`Failed to set script_running: ${runningErr.message}`);

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

    const { error: updateErr } = await db
      .from("episodes")
      .update({
        mem_note_id: memNoteId,
        title: generated.title.slice(0, 20),
        description: generated.description.slice(0, 100),
        status: "script_ready",
      })
      .eq("id", episode.id);
    if (updateErr) throw new Error(`Episode update failed: ${updateErr.message}`);

    await db.from("scripts").insert({
      episode_id: episode.id,
      content: generated.script,
      status: "ready",
      llm_usage: generated.tokenUsage,
      llm_response: generated.responseJson,
    });

    await queueSend(
      db,
      "audio-queue",
      regenerate ? { episode_id: episode.id, regenerate: true } : { episode_id: episode.id },
    );
    await queueDelete(db, "script-queue", msg.msg_id);
    await writeLog(db, {
      queue_name: "script-queue",
      message_id: msg.msg_id,
      article_id: episode.article_id,
      episode_id: episode.id,
      mem_note_id: memNoteId,
      status: "success",
      duration_ms: Date.now() - startMs,
    });
    console.log(`Script generated for article ${episode.article_id}, episode ${episode.id}`);
  } catch (err) {
    console.error(
      `generate-script failed for episode ${episodeIdForLog ?? "unknown"} (article ${articleIdForLog ?? "unknown"}):`,
      err,
    );
    if (episodeIdForLog) {
      await db.from("episodes").update({ status: "script_failed" }).eq("id", episodeIdForLog);
      await db.from("scripts").insert({
        episode_id: episodeIdForLog,
        content: "",
        status: "failed",
        error: String(err),
        llm_usage: {},
        llm_response: { error: String(err), regenerate },
      });
    }
    await queueDelete(db, "script-queue", msg.msg_id);
    await writeLog(db, {
      queue_name: "script-queue",
      message_id: msg.msg_id,
      ...(articleIdForLog ? { article_id: articleIdForLog } : {}),
      ...(episodeIdForLog ? { episode_id: episodeIdForLog } : {}),
      mem_note_id: memNoteId,
      status: "failure",
      error_message: String(err),
      duration_ms: Date.now() - startMs,
    });
  }
}
