#!/usr/bin/env tsx
/**
 * Dev helper: enqueue a job and start runJob pgflow flow.
 * Usage: TARGET=local pnpm job:run write_script --input '{"article_content":"..."}'
 */
import { createHash, randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  detectLocalStatus,
  detectProjectRef,
  detectServiceKey,
} from "./lib/supabase-detect.ts";

dotenv.config({ path: ".env" });

const args = process.argv.slice(2);
const jobType = args[0];
const inputIdx = args.indexOf("--input");
const inputJson = inputIdx >= 0 ? args[inputIdx + 1] : undefined;

if (!jobType || !inputJson) {
  console.error(
    'Usage: pnpm job:run <write_script|render_audio|paint_artwork> --input \'<json>\'',
  );
  process.exit(1);
}

const input = JSON.parse(inputJson) as Record<string, unknown>;
const idempotencyKey = createHash("sha256")
  .update(`${jobType}:${JSON.stringify(input)}`)
  .digest("hex");

const target = process.env.TARGET ?? "remote";
let url: string;
let key: string;
if (target === "local") {
  const local = detectLocalStatus();
  url = local.apiUrl;
  key = local.serviceKey;
} else {
  url = process.env.SUPABASE_URL ?? `https://${detectProjectRef()}.supabase.co`;
  key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? detectServiceKey(detectProjectRef());
}

const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const jobId = randomUUID();
  const { error: insertErr } = await db.schema("jobs").from("jobs").insert({
    id: jobId,
    job_type: jobType,
    idempotency_key: idempotencyKey,
    input,
    status: "requested",
  });
  if (insertErr) {
    if (insertErr.code === "23505") {
      const { data: existing } = await db
        .schema("jobs")
        .from("jobs")
        .select("id, status, output")
        .eq("job_type", jobType)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      console.log(JSON.stringify(existing, null, 2));
      return;
    }
    throw insertErr;
  }

  const { error: flowErr } = await db.schema("pgflow").rpc("start_flow", {
    flow_slug: "runJob",
    input: { jobId },
  });
  if (flowErr) throw flowErr;

  await db.schema("jobs").from("pgflow_job_bindings").upsert(
    { job_id: jobId, flow_slug: "runJob" },
    { onConflict: "job_id" },
  );

  console.log(JSON.stringify({ jobId, jobType, status: "requested" }, null, 2));
  console.error("Poll: TARGET=local curl -X POST http://127.0.0.1:54331/functions/v1/external-operation-poller");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
