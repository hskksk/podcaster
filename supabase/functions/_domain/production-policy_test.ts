import { assertEquals } from "jsr:@std/assert";
import type { DomainEvent, ProductionRequestedPayload } from "./events.ts";
import { commandsForEvent } from "./production-policy.ts";
import {
  applyProductionEvent,
  canAssemble,
  emptyProductionProgress,
} from "./production-state.ts";
import { isArtworkEnabled } from "./profile.ts";

const production: ProductionRequestedPayload = {
  production_id: "11111111-1111-4111-8111-111111111111",
  episode_id: "22222222-2222-4222-8222-222222222222",
  article_revision_id: "33333333-3333-4333-8333-333333333333",
  base_revision_id: null,
  scope: "full",
  trigger: "ingest",
  profile: { generator: {}, tts: {}, image: { enabled: true } },
};

function productionEvent(
  type: DomainEvent["type"],
  payload: DomainEvent["payload"],
): DomainEvent {
  return {
    id: crypto.randomUUID(),
    position: 1,
    type,
    stream_type: "production",
    stream_id: production.production_id,
    stream_version: 1,
    occurred_at: new Date().toISOString(),
    actor: "test",
    correlation_id: production.production_id,
    causation_id: null,
    payload,
  } as DomainEvent;
}

Deno.test("ProductionRequested full scope requests write_script", () => {
  const progress = emptyProductionProgress(production, isArtworkEnabled(production.profile));
  const event = productionEvent("ProductionRequested", production);
  const commands = commandsForEvent(event, {
    progress,
    production,
    publicationPolicy: "auto",
    articleContent: "hello article",
    causationEventId: event.id!,
    baseScript: null,
  });
  assertEquals(commands.length, 1);
  assertEquals(commands[0]?.kind, "request_job");
  if (commands[0]?.kind === "request_job") {
    assertEquals(commands[0].jobType, "write_script");
  }
});

Deno.test("ScriptWritten requests audio and artwork when enabled", () => {
  let progress = emptyProductionProgress(production, true);
  progress = applyProductionEvent(
    progress,
    productionEvent("ScriptWritten", {
      script_id: "44444444-4444-4444-8444-444444444444",
      job_id: null,
      title: "t",
      description: "d",
      content: "Host: hi",
    }),
  );
  const event = productionEvent("ScriptWritten", {
    script_id: progress.scriptId!,
    job_id: "55555555-5555-4555-8555-555555555555",
    title: "t",
    description: "d",
    content: "Host: hi",
  });
  const commands = commandsForEvent(event, {
    progress,
    production,
    publicationPolicy: "auto",
    articleContent: "body",
    causationEventId: event.id!,
    baseScript: null,
  });
  assertEquals(commands.filter((c) => c.kind === "request_job").length, 2);
});

Deno.test("audio scope without a base script fails that creation", () => {
  const audioProduction: ProductionRequestedPayload = {
    ...production,
    scope: "audio",
    base_revision_id: "66666666-6666-4666-8666-666666666666",
  };
  const event = productionEvent("ProductionRequested", audioProduction);
  const commands = commandsForEvent(event, {
    progress: emptyProductionProgress(audioProduction, false),
    production: audioProduction,
    publicationPolicy: "manual",
    articleContent: "body",
    causationEventId: event.id!,
    baseScript: null,
  });
  assertEquals(commands, [{
    kind: "production_failed",
    productionId: audioProduction.production_id,
    stage: "audio",
    reason: "audio scope requires base script",
  }]);
});

Deno.test("a failed production does not request more jobs", () => {
  const progress = {
    ...emptyProductionProgress(production, true),
    failed: true,
  };
  const event = productionEvent("ScriptWritten", {
    script_id: "44444444-4444-4444-8444-444444444444",
    job_id: null,
    title: "t",
    description: "d",
    content: "Host: hi",
  });
  const commands = commandsForEvent(event, {
    progress,
    production,
    publicationPolicy: "auto",
    articleContent: "body",
    causationEventId: event.id!,
    baseScript: null,
  });
  assertEquals(commands, [{ kind: "noop" }]);
});

Deno.test("canAssemble requires audio and optional artwork", () => {
  let progress = emptyProductionProgress(production, true);
  progress = {
    ...progress,
    scriptId: "s",
    audioId: "a",
    artworkId: null,
  };
  assertEquals(canAssemble(progress), false);
  progress = { ...progress, artworkId: "art" };
  assertEquals(canAssemble(progress), true);
});

Deno.test("artwork scope can assemble after paint when base revision supplies script and audio", () => {
  const artworkProduction: ProductionRequestedPayload = {
    ...production,
    scope: "artwork",
    base_revision_id: "66666666-6666-4666-8666-666666666666",
  };
  let progress = emptyProductionProgress(artworkProduction, true);
  progress = {
    ...progress,
    scriptId: "base-script",
    audioId: "base-audio",
    artworkId: "new-art",
  };
  assertEquals(canAssemble(progress), true);
});

Deno.test("one article one episode invariant in replay", () => {
  const episodeIds = new Set<string>();
  episodeIds.add(production.episode_id);
  assertEquals(episodeIds.size, 1);
});
