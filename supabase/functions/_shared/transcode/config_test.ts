import { assertEquals } from "jsr:@std/assert@1";
import {
  assertGcpRunConfig,
  gcpRunConfig,
  isCloudRunExecutionName,
  isTranscodeEnabled,
} from "./config.ts";

Deno.test("isCloudRunExecutionName", () => {
  assertEquals(
    isCloudRunExecutionName("projects/p/locations/r/jobs/j/executions/e"),
    true,
  );
  assertEquals(isCloudRunExecutionName("batches/abc"), false);
  assertEquals(
    isCloudRunExecutionName("projects/p/locations/r/operations/op-123"),
    false,
  );
  assertEquals(
    isCloudRunExecutionName("projects/p/locations/r/jobs/j"),
    false,
  );
});

Deno.test("isTranscodeEnabled respects delivery format and flag", () => {
  assertEquals(
    isTranscodeEnabled({ "audio.delivery.format": "wav", "audio.transcode.enabled": true }),
    false,
  );
  assertEquals(
    isTranscodeEnabled({ "audio.delivery.format": "m4a", "audio.transcode.enabled": false }),
    false,
  );
  assertEquals(
    isTranscodeEnabled({ "audio.delivery.format": "m4a", "audio.transcode.enabled": true }),
    true,
  );
});

Deno.test("gcpRunConfig reads Edge env", () => {
  const prev = {
    project: Deno.env.get("GCP_PROJECT_ID"),
    region: Deno.env.get("GCP_REGION"),
    job: Deno.env.get("GCP_RUN_JOB_NAME"),
    sa: Deno.env.get("GCP_SERVICE_ACCOUNT_JSON"),
  };
  try {
    Deno.env.delete("GCP_PROJECT_ID");
    Deno.env.delete("GCP_REGION");
    Deno.env.delete("GCP_RUN_JOB_NAME");
    Deno.env.delete("GCP_SERVICE_ACCOUNT_JSON");
    assertEquals(gcpRunConfig(), {
      projectId: "",
      region: "asia-northeast1",
      jobName: "audio-transcode",
    });

    Deno.env.set("GCP_PROJECT_ID", "my-proj");
    Deno.env.set("GCP_REGION", "europe-west1");
    Deno.env.set("GCP_RUN_JOB_NAME", "custom-job");
    assertEquals(gcpRunConfig(), {
      projectId: "my-proj",
      region: "europe-west1",
      jobName: "custom-job",
    });
    assertEquals(assertGcpRunConfig(), {
      projectId: "my-proj",
      region: "europe-west1",
      jobName: "custom-job",
    });
  } finally {
    for (const [key, val] of [
      ["GCP_PROJECT_ID", prev.project],
      ["GCP_REGION", prev.region],
      ["GCP_RUN_JOB_NAME", prev.job],
      ["GCP_SERVICE_ACCOUNT_JSON", prev.sa],
    ] as const) {
      if (val === undefined) Deno.env.delete(key);
      else Deno.env.set(key, val);
    }
  }
});
