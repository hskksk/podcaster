import { createSupabaseClient } from "../_shared/db.ts";
import { getPostgresSql } from "../_shared/postgres.ts";
import { publishEpisodeRevision } from "../_services/publish-episode.ts";
import { processSubscriptionBatch } from "../_adapters/eventstore/subscription.ts";
import { handleProductionPolicyEvent } from "../_services/production-policy-handler.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: {
    action?: "publish" | "withdraw";
    episode_id?: string;
    episode_revision_id?: string;
    publication_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const action = body.action ?? "publish";
  const db = createSupabaseClient();
  const sql = getPostgresSql();

  try {
    if (action === "withdraw") {
      if (!body.publication_id) {
        return new Response("publication_id required", { status: 400 });
      }
      await publishEpisodeRevision(db, sql, {
        episodeId: body.episode_id ?? "",
        episodeRevisionId: body.episode_revision_id ?? "",
        actor: "publish-api",
        causationEventId: crypto.randomUUID(),
        withdraw: true,
        publicationId: body.publication_id,
      });
    } else {
      if (!body.episode_id || !body.episode_revision_id) {
        return new Response("episode_id and episode_revision_id required", { status: 400 });
      }
      await publishEpisodeRevision(db, sql, {
        episodeId: body.episode_id,
        episodeRevisionId: body.episode_revision_id,
        actor: "publish-api",
        causationEventId: crypto.randomUUID(),
      });
    }

    await processSubscriptionBatch(db, sql, handleProductionPolicyEvent);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("publish:", err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});
