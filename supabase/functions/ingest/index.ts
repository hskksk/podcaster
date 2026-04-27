import { createSupabaseClient } from "../_shared/db.ts";
import { queueSend } from "../_shared/queue.ts";

const MEM_API_KEY = Deno.env.get("MEM_API_KEY");

async function fetchMemContent(noteId: string): Promise<{ content: string; title?: string }> {
  if (!MEM_API_KEY) throw new Error("MEM_API_KEY is not configured");
  const res = await fetch(`https://api.mem.ai/v2/notes/${noteId}`, {
    headers: {
      Authorization: `Bearer ${MEM_API_KEY}`,
    },
  });
  if (res.status === 404) throw Object.assign(new Error("mem note not found"), { status: 404 });
  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error(`mem.ai auth error ${res.status}`), { status: 502 });
  }
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`mem.ai API error ${res.status}: ${text}`), { status: 502 });
  }
  const data = await res.json();
  if (!data.content) throw Object.assign(new Error("mem.ai response has no content field"), { status: 502 });
  return {
    content: data.content as string,
    title: data.title as string | undefined,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: { title?: string; mem_note_id?: string; source_url?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.mem_note_id?.trim()) {
    return new Response("Missing mem_note_id", { status: 400 });
  }

  let memData: { content: string; title?: string };
  try {
    memData = await fetchMemContent(body.mem_note_id.trim());
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    console.error("fetchMemContent failed:", err);
    return new Response((err as Error).message, { status });
  }

  const { content, title: memTitle } = memData;

  if (!content.trim()) {
    return new Response("Missing content", { status: 400 });
  }

  const db = createSupabaseClient();
  const { data: article, error } = await db
    .from("articles")
    .insert({
      title: memTitle || body.title || "Untitled",
      content: content.trim(),
      source_url: body.source_url,
      source: "webhook",
      mem_note_id: body.mem_note_id.trim(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("articles insert failed:", error);
    return new Response("Internal error", { status: 500 });
  }

  await queueSend(db, "script-queue", { article_id: article.id });

  return Response.json({ ok: true, article_id: article.id }, { status: 202 });
});
