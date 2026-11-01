import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function dispatchRunJob(db: SupabaseClient, jobId: string): Promise<void> {
  await startRunJobFlow(db, jobId);
}

export async function startRunJobFlow(
  db: SupabaseClient,
  jobId: string,
): Promise<void> {
  const { error } = await db.schema("pgflow").rpc("start_flow", {
    flow_slug: "runJob",
    input: { jobId },
  });
  if (error) throw new Error(`startRunJobFlow: ${error.message}`);

  await db.schema("jobs").from("pgflow_job_bindings").upsert(
    { job_id: jobId, flow_slug: "runJob" },
    { onConflict: "job_id" },
  );
}
