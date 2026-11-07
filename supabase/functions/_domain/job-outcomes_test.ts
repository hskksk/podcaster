import { assertEquals } from "jsr:@std/assert";
import {
  clipFailureReason,
  domainEventForFailedJob,
  failureStageForJobType,
  type JobOutcomeSource,
} from "./job-outcomes.ts";

function job(jobType: JobOutcomeSource["job_type"]): JobOutcomeSource {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    job_type: jobType,
    correlation_id: "11111111-1111-4111-8111-111111111111",
    requested_by_event_id: "66666666-6666-4666-8666-666666666666",
    input: {},
    output: null,
  };
}

Deno.test("terminal job failure names the creation that stopped", () => {
  assertEquals(failureStageForJobType("write_script"), "script");
  assertEquals(failureStageForJobType("render_audio"), "audio");
  assertEquals(failureStageForJobType("paint_artwork"), "artwork");

  const event = domainEventForFailedJob(job("render_audio"), "Gemini batch JOB_STATE_FAILED");
  if (!event) throw new Error("expected ProductionFailed");
  assertEquals(event.type, "ProductionFailed");
  assertEquals(event.payload.stage, "audio");
  assertEquals(event.payload.failed_job_id, job("render_audio").id);
  assertEquals(event.payload.reason, "Gemini batch JOB_STATE_FAILED");
  assertEquals(event.stream_id, job("render_audio").correlation_id);
});

Deno.test("empty failure reason falls back, long reason is clipped", () => {
  assertEquals(clipFailureReason("  "), "job failed after retries");
  const event = domainEventForFailedJob(job("write_script"), "x".repeat(2500));
  if (!event) throw new Error("expected ProductionFailed");
  assertEquals(event.payload.stage, "script");
  assertEquals(event.payload.reason.length, 2000);
});

Deno.test("a job without a production does not become a domain event", () => {
  const orphan = job("write_script");
  orphan.correlation_id = null;
  assertEquals(domainEventForFailedJob(orphan, "boom"), null);
});
