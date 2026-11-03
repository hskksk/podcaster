import { assertEquals } from "jsr:@std/assert@1";
import {
  isCloudRunExecutionName,
  isTranscodeEnabled,
} from "./config.ts";

Deno.test("isCloudRunExecutionName", () => {
  assertEquals(
    isCloudRunExecutionName("projects/p/locations/r/jobs/j/executions/e"),
    true,
  );
  assertEquals(isCloudRunExecutionName("batches/abc"), false);
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
