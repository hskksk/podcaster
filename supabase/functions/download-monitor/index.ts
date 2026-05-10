import { createSupabaseClient } from "../_shared/db.ts";
import { writeLog } from "../_shared/logger.ts";

const DEFAULT_SCAN_LIMIT = 20;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const startedAt = Date.now();
  const db = createSupabaseClient();
  const scanLimit = DEFAULT_SCAN_LIMIT;

  const { data: episodes, error: episodesErr } = await db
    .from("episodes")
    .select("id, article_id, mem_note_id")
    .eq("status", "audio_generated")
    .order("created_at", { ascending: true })
    .limit(scanLimit);
  if (episodesErr) {
    console.error("[download-monitor] failed to list audio_generated episodes", episodesErr);
    return new Response("Failed to query episodes", { status: 500 });
  }

  let startedFlows = 0;
  const skipped: Array<{ episodeId: string; reason: string }> = [];

  for (const episode of episodes ?? []) {
    const { data: pendingAudio, error: audioErr } = await db
      .from("audio_files")
      .select("batch_name")
      .eq("episode_id", episode.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (audioErr) {
      console.error("[download-monitor] failed to read pending audio", audioErr);
      skipped.push({ episodeId: episode.id, reason: "audio_lookup_failed" });
      continue;
    }
    if (!pendingAudio?.batch_name) {
      skipped.push({ episodeId: episode.id, reason: "missing_batch_name" });
      continue;
    }

    const { data: lockedEpisode, error: lockErr } = await db
      .from("episodes")
      .update({ status: "audio_downloading" })
      .eq("id", episode.id)
      .eq("status", "audio_generated")
      .select("id")
      .maybeSingle();
    if (lockErr) {
      console.error("[download-monitor] failed to lock episode", lockErr);
      skipped.push({ episodeId: episode.id, reason: "lock_failed" });
      continue;
    }
    if (!lockedEpisode) {
      skipped.push({ episodeId: episode.id, reason: "already_locked" });
      continue;
    }

    const { error: startErr } = await db
      .schema("pgflow")
      .rpc("start_flow", {
        flow_slug: "craftEpisodeDownload",
        input: {
          episodeId: episode.id,
          batchName: pendingAudio.batch_name,
          trigger: "monitor",
        },
      });
    if (startErr) {
      console.error("[download-monitor] failed to start craftEpisodeDownload", startErr);
      await db
        .from("episodes")
        .update({ status: "audio_generated" })
        .eq("id", episode.id)
        .eq("status", "audio_downloading");
      skipped.push({ episodeId: episode.id, reason: "start_flow_failed" });
      continue;
    }

    startedFlows += 1;
    await writeLog(db, {
      queue_name: "download-monitor",
      message_id: null,
      episode_id: episode.id,
      article_id: episode.article_id ?? null,
      mem_note_id: episode.mem_note_id ?? null,
      status: "success",
      duration_ms: 0,
    });
  }

  const durationMs = Date.now() - startedAt;
  return Response.json({
    ok: true,
    scanned: episodes?.length ?? 0,
    startedFlows,
    skipped,
    durationMs,
  });
});
