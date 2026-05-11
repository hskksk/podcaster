import { createSupabaseClient } from "../_shared/db.ts";
import { writeLog } from "../_shared/logger.ts";

/** Episodes waiting on Gemini batch; download flow polls job state then fetches output. */
const DOWNLOADABLE_EPISODE_STATUSES = ["audio_running", "audio_generated"] as const;

/** Upper bound when searching oldest pending batch jobs for a downloadable episode. */
const MAX_PENDING_SCAN = 50;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const startedAt = Date.now();
  const db = createSupabaseClient();

  const { data: pendingRows, error: pendingErr } = await db
    .from("audio_files")
    .select("episode_id, batch_name")
    .eq("status", "pending")
    .not("batch_name", "is", null)
    .order("created_at", { ascending: true })
    .limit(MAX_PENDING_SCAN);

  if (pendingErr) {
    console.error("[download-monitor] failed to list pending audio", pendingErr);
    return new Response("Failed to query audio_files", { status: 500 });
  }

  const downloadable = new Set<string>(DOWNLOADABLE_EPISODE_STATUSES);

  let candidate: {
    episodeId: string;
    batchName: string;
    article_id: string | null;
    mem_note_id: string | null;
    previousStatus: string;
  } | null = null;

  for (const row of pendingRows ?? []) {
    const episodeId = row.episode_id as string;
    const batchName = String(row.batch_name ?? "").trim();
    if (!batchName) continue;

    const { data: episode, error: epErr } = await db
      .from("episodes")
      .select("id, status, article_id, mem_note_id")
      .eq("id", episodeId)
      .maybeSingle();

    if (epErr) {
      console.error("[download-monitor] episode lookup failed", epErr);
      const durationMs = Date.now() - startedAt;
      return Response.json({ ok: false, error: "episode_lookup_failed", durationMs }, { status: 500 });
    }
    if (!episode) continue;

    if (!downloadable.has(episode.status)) {
      continue;
    }

    candidate = {
      episodeId: episode.id,
      batchName,
      article_id: episode.article_id ?? null,
      mem_note_id: episode.mem_note_id ?? null,
      previousStatus: episode.status,
    };
    break;
  }

  if (!candidate) {
    const durationMs = Date.now() - startedAt;
    return Response.json({
      ok: true,
      scanned: pendingRows?.length ?? 0,
      startedFlows: 0,
      skipped: [],
      durationMs,
    });
  }

  const { data: lockedEpisode, error: lockErr } = await db
    .from("episodes")
    .update({ status: "audio_downloading" })
    .eq("id", candidate.episodeId)
    .in("status", [...DOWNLOADABLE_EPISODE_STATUSES])
    .select("id")
    .maybeSingle();

  if (lockErr) {
    console.error("[download-monitor] failed to lock episode", lockErr);
    const durationMs = Date.now() - startedAt;
    return Response.json({ ok: false, error: "lock_failed", durationMs }, { status: 500 });
  }

  if (!lockedEpisode) {
    const durationMs = Date.now() - startedAt;
    return Response.json({
      ok: true,
      scanned: pendingRows?.length ?? 0,
      startedFlows: 0,
      skipped: [{ episodeId: candidate.episodeId, reason: "already_locked_or_moved" }],
      durationMs,
    });
  }

  const { error: startErr } = await db.schema("pgflow").rpc("start_flow", {
    flow_slug: "craftEpisodeDownload",
    input: {
      episodeId: candidate.episodeId,
      batchName: candidate.batchName,
      trigger: "monitor",
    },
  });

  if (startErr) {
    console.error("[download-monitor] failed to start craftEpisodeDownload", startErr);
    await db
      .from("episodes")
      .update({ status: candidate.previousStatus })
      .eq("id", candidate.episodeId)
      .eq("status", "audio_downloading");

    const durationMs = Date.now() - startedAt;
    return Response.json(
      {
        ok: false,
        error: String(startErr.message ?? startErr),
        scanned: pendingRows?.length ?? 0,
        startedFlows: 0,
        skipped: [{ episodeId: candidate.episodeId, reason: "start_flow_failed" }],
        durationMs,
      },
      { status: 500 },
    );
  }

  await writeLog(db, {
    queue_name: "download-monitor",
    message_id: null,
    episode_id: candidate.episodeId,
    article_id: candidate.article_id,
    mem_note_id: candidate.mem_note_id,
    status: "success",
    duration_ms: 0,
  });

  const durationMs = Date.now() - startedAt;
  return Response.json({
    ok: true,
    scanned: pendingRows?.length ?? 0,
    startedFlows: 1,
    skipped: [],
    durationMs,
  });
});
