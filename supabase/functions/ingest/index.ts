import { createSupabaseClient } from "../_shared/db.ts";
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
    console.error("ingest failed:", err);
    return new Response("Internal error", { status: 500 });
  }
});
