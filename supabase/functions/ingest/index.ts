import { createSupabaseClient } from "../_shared/db.ts";
import { queueSend } from "../_shared/queue.ts";

const WEBHOOK_SECRET = Deno.env.get("INGEST_WEBHOOK_SECRET");

async function verifySignature(req: Request): Promise<boolean> {
  if (!WEBHOOK_SECRET) return true; // dev mode: skip verification

  const sig = req.headers.get("x-signature");
  if (!sig) return false;

  const body = await req.text();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return sig === `sha256=${expected}`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const isValid = await verifySignature(req.clone());
  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { title?: string; content?: string; source_url?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.content?.trim()) {
    return new Response("Missing content", { status: 400 });
  }

  const db = createSupabaseClient();
  const { data: article, error } = await db
    .from("articles")
    .insert({
      title: body.title || "Untitled",
      content: body.content.trim(),
      source_url: body.source_url,
      source: "webhook",
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
