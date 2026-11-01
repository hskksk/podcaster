import { createSupabaseClient } from "../_shared/db.ts";
import { getPostgresSql } from "../_shared/postgres.ts";
import { processSubscriptionBatch } from "../_adapters/eventstore/subscription.ts";
import { handleProductionPolicyEvent } from "../_services/production-policy-handler.ts";

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return Response.json({ ok: true, worker: "domain-subscriber" });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const db = createSupabaseClient();
  const sql = getPostgresSql();
  try {
    const { processed } = await processSubscriptionBatch(
      db,
      sql,
      handleProductionPolicyEvent,
    );
    return Response.json({ ok: true, processed });
  } catch (err) {
    console.error("domain-subscriber:", err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});
