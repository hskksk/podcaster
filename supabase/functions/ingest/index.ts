import { createSupabaseClient } from "../_shared/db.ts";
import { loadConfig } from "../_shared/config.ts";
import { ingestViaEvents } from "../_services/ingest-events.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: {
    title?: string;
    content?: string;
    mem_note_id?: string;
    source_url?: string;
    ingest_route?: string;
    ingest_meta?: Record<string, unknown>;
    content_path?: string;
    content_sha?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const content = body.content?.trim() ?? "";
  if (!content) {
    return new Response("Missing content", { status: 400 });
  }

  const cfg = await loadConfig();
  const pipelineMode = String(cfg["pipeline.mode"] ?? "legacy").replace(/"/g, "");

  if (pipelineMode === "events") {
    const db = createSupabaseClient();
    try {
      const result = await ingestViaEvents(db, {
        title: body.title,
        content,
        mem_note_id: body.mem_note_id?.trim() ?? null,
        source_url: body.source_url,
        ingest_route: body.ingest_route ?? null,
        ingest_meta: body.ingest_meta,
        content_path: body.content_path?.trim() || null,
        content_sha: body.content_sha?.trim() || null,
      });
      return Response.json({ ok: true, ...result }, { status: 202 });
    } catch (err) {
      console.error("ingest events path failed:", err);
      return new Response("Internal error", { status: 500 });
    }
  }

  const resolvedTitle = body.title;
  const contentPath = body.content_path?.trim() || null;
  const contentSha = body.content_sha?.trim() || null;

  const db = createSupabaseClient();
  const { data: article, error } = await db
    .from("articles")
    .insert({
      title: resolvedTitle || "Untitled",
      content,
      source_url: body.source_url,
      source: "webhook",
      mem_note_id: body.mem_note_id?.trim() ?? null,
      ingest_route: body.ingest_route ?? null,
      ingest_meta: body.ingest_meta ?? null,
      content_path: contentPath,
      content_sha: contentSha,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return new Response("Duplicate content_path", { status: 409 });
    }
    console.error("articles insert failed:", error);
    return new Response("Internal error", { status: 500 });
  }

  const episodeId = crypto.randomUUID();
  const { data: episode, error: episodeErr } = await db
    .from("episodes")
    .insert({
      id: episodeId,
      article_id: article.id,
      mem_note_id: body.mem_note_id?.trim() ?? null,
      title: (resolvedTitle || "Untitled").slice(0, 20),
      description: "",
      status: "ingested",
      audio_url: `audio/${episodeId}.wav`,
    })
    .select("id")
    .single();
  if (episodeErr || !episode) {
    console.error("episodes insert failed:", episodeErr);
    return new Response("Internal error", { status: 500 });
  }

  const { error: flowErr } = await db
    .schema("pgflow")
    .rpc("start_flow", {
      flow_slug: "craftEpisodeSubmit",
      input: {
        episodeId: episode.id,
        regenerate: false,
        startFrom: "script",
        trigger: "ingest",
      },
    });
  if (flowErr) {
    console.error("pgflow.start_flow failed:", flowErr);
    return new Response("Failed to start flow", { status: 500 });
  }

  return Response.json({ ok: true, article_id: article.id, episode_id: episode.id }, { status: 202 });
});
