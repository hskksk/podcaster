import { createSupabaseClient } from "../functions/_shared/db.ts";
import { runJobById } from "../functions/_jobs/runner.ts";
import { onJobFinished } from "../functions/_services/job-outcomes.ts";

export async function runJobStep(input: { jobId: string }) {
  const db = createSupabaseClient();
  const result = await runJobById(db, input.jobId);
  if (result.status === "succeeded" || result.status === "failed") {
    await onJobFinished(db, input.jobId).catch((err) => {
      console.error("onJobFinished:", err);
    });
  }
  return result;
}
