import { createSupabaseClient } from "../functions/_shared/db.ts";
import { runJobById } from "../functions/_jobs/runner.ts";

export async function runJobStep(input: { jobId: string }) {
  const db = createSupabaseClient();
  return await runJobById(db, input.jobId);
}
