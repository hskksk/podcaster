import { createSupabaseClient } from "../_shared/db.ts";
import { loadConfig } from "../_shared/config.ts";
import { resolveGeminiJwksUrl } from "../_shared/gemini-endpoint.ts";
import { verifyGeminiWebhookJwt } from "../_shared/gemini-webhook-verify.ts";
import { writeLog } from "../_shared/logger.ts";

type GeminiWebhookPayload = {
  type?: string;
  timestamp?: string;
  data?: {
    id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function parseIssuerList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((issuer) => issuer.trim())
    .filter((issuer) => issuer.length > 0);
}

async function findAudioByBatchName(db: ReturnType<typeof createSupabaseClient>, rawBatchId: string) {
  const candidates = rawBatchId.startsWith("batches/")
    ? [rawBatchId, rawBatchId.slice("batches/".length)]
    : [rawBatchId, `batches/${rawBatchId}`];

  for (const candidate of candidates) {
    const { data, error } = await db
      .from("audio_files")
      .select("id, episode_id, batch_name")
      .eq("batch_name", candidate)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Failed to lookup batch_name ${candidate}: ${error.message}`);
    if (data) return data;
  }
  return null;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  console.log(`[audio-batch-callback] request started request_id=${requestId} method=${req.method}`);

  if (req.method !== "POST") {
    console.log(`[audio-batch-callback] reject method request_id=${requestId} method=${req.method}`);
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("Webhook-Signature") ?? req.headers.get("webhook-signature");
  if (!signature) {
    console.log(`[audio-batch-callback] missing signature request_id=${requestId}`);
    return new Response("Missing Webhook-Signature", { status: 401 });
  }

  const rawBody = await req.text();
  let payload: GeminiWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as GeminiWebhookPayload;
  } catch {
    console.log(`[audio-batch-callback] invalid json request_id=${requestId}`);
    return new Response("Invalid JSON body", { status: 400 });
  }

  const batchId = payload.data?.id?.trim();
  if (!batchId) {
    console.log(`[audio-batch-callback] missing batch id request_id=${requestId}`);
    return new Response("Missing payload.data.id", { status: 400 });
  }
  console.log(
    `[audio-batch-callback] payload parsed request_id=${requestId} batch_id=${batchId} event_type=${payload.type ?? "unknown"}`,
  );

  const db = createSupabaseClient();
  const cfg = await loadConfig();
  const callbackUrl = String(cfg["gemini.webhook_callback_url"] ?? "").trim();
  const audience = String(cfg["gemini.webhook_audience"] ?? callbackUrl).trim();
  const jwksUrl = resolveGeminiJwksUrl(cfg);
  const issuerConfig = parseIssuerList(cfg["gemini.webhook_issuer"]);

  if (!audience) {
    return new Response("Missing gemini.webhook_audience config", { status: 500 });
  }

  try {
    await verifyGeminiWebhookJwt({
      token: signature,
      jwksUrl,
      audience,
      issuers: issuerConfig.length > 0 ? issuerConfig : undefined,
    });
    console.log(`[audio-batch-callback] signature verified request_id=${requestId} batch_id=${batchId}`);
  } catch (error) {
    console.error("[audio-batch-callback] signature verification failed", error);
    return new Response("Invalid webhook signature", { status: 401 });
  }

  const matchedAudio = await findAudioByBatchName(db, batchId);
  if (!matchedAudio) {
    console.log(`[audio-batch-callback] unknown batch request_id=${requestId} batch_id=${batchId}`);
    return Response.json({ ok: true, ignored: "unknown_batch", batchId });
  }

  const now = new Date().toISOString();
  const callbackPayload = payload as Record<string, unknown>;
  const { error: updateAudioErr } = await db
    .from("audio_files")
    .update({
      callback_received_at: now,
      callback_payload: callbackPayload,
    })
    .eq("id", matchedAudio.id);
  if (updateAudioErr) {
    console.error("[audio-batch-callback] failed to update audio_files", updateAudioErr);
    return new Response("Failed to update callback state", { status: 500 });
  }
  console.log(
    `[audio-batch-callback] callback persisted request_id=${requestId} batch_id=${batchId} audio_file_id=${matchedAudio.id}`,
  );

  if (payload.type && payload.type !== "batch.succeeded") {
    console.log(
      `[audio-batch-callback] ignore non-succeeded event request_id=${requestId} batch_id=${batchId} event_type=${payload.type}`,
    );
    return Response.json({
      ok: true,
      ignored: "non_succeeded_event",
      batchId,
      eventType: payload.type,
    });
  }

  const { data: episode, error: episodeErr } = await db
    .from("episodes")
    .select("id, status, article_id, mem_note_id")
    .eq("id", matchedAudio.episode_id)
    .maybeSingle();
  if (episodeErr || !episode) {
    console.error("[audio-batch-callback] failed to load episode", episodeErr);
    return new Response("Episode not found", { status: 500 });
  }

  const nonTransitionStatuses = new Set(["audio_ready", "published", "audio_failed"]);
  let transitioned = false;
  if (!nonTransitionStatuses.has(episode.status)) {
    const { data: updatedEpisode, error: updateEpisodeErr } = await db
      .from("episodes")
      .update({ status: "audio_generated" })
      .eq("id", episode.id)
      .in("status", ["audio_running", "audio_generated"])
      .select("id")
      .maybeSingle();
    if (updateEpisodeErr) {
      console.error("[audio-batch-callback] failed to update episode status", updateEpisodeErr);
      return new Response("Failed to transition episode status", { status: 500 });
    }
    transitioned = Boolean(updatedEpisode);
  }
  console.log(
    `[audio-batch-callback] episode handled request_id=${requestId} episode_id=${episode.id} previous_status=${episode.status} transitioned=${transitioned}`,
  );

  await writeLog(db, {
    queue_name: "audio-batch-callback",
    message_id: null,
    episode_id: episode.id,
    article_id: episode.article_id ?? null,
    mem_note_id: episode.mem_note_id ?? null,
    status: "success",
    duration_ms: 0,
  });

  const durationMs = Date.now() - startedAt;
  console.log(
    `[audio-batch-callback] request completed request_id=${requestId} batch_id=${batchId} episode_id=${episode.id} duration_ms=${durationMs}`,
  );

  return Response.json({
    ok: true,
    batchId,
    episodeId: episode.id,
    transitioned,
    eventType: payload.type ?? null,
  });
});
