import { createSupabaseClient } from "../_shared/db.ts";

const MEM_API_KEY = Deno.env.get("MEM_API_KEY");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchMemContent(noteId: string): Promise<{ content: string; title?: string }> {
  if (!MEM_API_KEY) throw new Error("MEM_API_KEY is not configured");
  const maxAttempts = 3;
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`https://api.mem.ai/v2/notes/${noteId}`, {
      headers: {
        Authorization: `Bearer ${MEM_API_KEY}`,
      },
    });

    if (res.status === 404) throw Object.assign(new Error("mem note not found"), { status: 404 });
    if (res.status === 401 || res.status === 403) {
      throw Object.assign(new Error(`mem.ai auth error ${res.status}`), { status: 502 });
    }

    if (res.ok) {
      const data = await res.json();
      if (!data.content) throw Object.assign(new Error("mem.ai response has no content field"), { status: 502 });
      return {
        content: data.content as string,
        title: data.title as string | undefined,
      };
    }

    lastStatus = res.status;
    lastBody = await res.text();
    const isRetriable = res.status >= 500 && res.status < 600;
    if (!isRetriable || attempt === maxAttempts) break;
    await sleep(300 * (2 ** (attempt - 1)));
  }

  throw Object.assign(
    new Error(`mem.ai API error ${lastStatus}: ${lastBody}`),
    { status: 502 },
  );
}

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
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.content?.trim() && !body.mem_note_id?.trim()) {
    return new Response("Missing content or mem_note_id", { status: 400 });
  }

  let content: string;
  let resolvedTitle: string | undefined;

  if (body.content?.trim()) {
    content = body.content.trim();
    resolvedTitle = body.title;
  } else {
    let memData: { content: string; title?: string };
    try {
      memData = await fetchMemContent(body.mem_note_id!.trim());
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500;
      console.error("fetchMemContent failed:", err);
      return new Response((err as Error).message, { status });
    }
    content = memData.content;
    resolvedTitle = memData.title || body.title;
  }

  if (!content.trim()) {
    return new Response("Missing content", { status: 400 });
  }

  const db = createSupabaseClient();
  const { data: article, error } = await db
    .from("articles")
    .insert({
      title: resolvedTitle || "Untitled",
      content: content.trim(),
      source_url: body.source_url,
      source: "webhook",
      mem_note_id: body.mem_note_id?.trim() ?? null,
      ingest_route: body.ingest_route ?? null,
      ingest_meta: body.ingest_meta ?? null,
    })
    .select("id")
    .single();

  if (error) {
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
