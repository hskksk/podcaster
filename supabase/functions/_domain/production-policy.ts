import type { DomainEvent, ProductionRequestedPayload } from "./events.ts";
import { flattenProductionProfile, isArtworkEnabled } from "./profile.ts";
import { canAssemble, type ProductionProgress } from "./production-state.ts";

export type JobTypeName = "write_script" | "render_audio" | "paint_artwork";

export type PolicyCommand =
  | {
    kind: "request_job";
    jobType: JobTypeName;
    input: Record<string, unknown>;
    idempotencyKey: string;
  }
  | { kind: "assemble"; episodeId: string; productionId: string }
  | { kind: "auto_publish"; episodeId: string; episodeRevisionId: string }
  | { kind: "production_failed"; productionId: string; reason: string }
  | { kind: "noop" };

export interface PolicyScriptContext {
  scriptId: string;
  title: string;
  description: string;
  content: string;
  articleExcerpt: string;
}

export interface PolicyContext {
  progress: ProductionProgress;
  production: ProductionRequestedPayload;
  publicationPolicy: "auto" | "manual";
  articleContent: string;
  causationEventId: string;
  /** Latest script for audio/artwork-only scopes (from base revision). */
  baseScript: PolicyScriptContext | null;
}

export function commandsForEvent(
  event: DomainEvent,
  ctx: PolicyContext,
): PolicyCommand[] {
  if (ctx.progress.failed) return [{ kind: "noop" }];

  switch (event.type) {
    case "ProductionRequested":
      return commandsForProductionRequested(ctx);
    case "ScriptWritten":
      if (event.correlation_id !== ctx.production.production_id) {
        return [{ kind: "noop" }];
      }
      return commandsAfterScriptWritten(
        ctx,
        event.payload.title,
        event.payload.description,
        event.payload.content,
      );
    case "AudioRendered":
    case "ArtworkPainted":
      if (event.correlation_id !== ctx.production.production_id) {
        return [{ kind: "noop" }];
      }
      if (canAssemble(ctx.progress)) {
        return [{
          kind: "assemble",
          episodeId: ctx.production.episode_id,
          productionId: ctx.production.production_id,
        }];
      }
      return [{ kind: "noop" }];
    case "EpisodeAssembled":
      if (event.correlation_id !== ctx.production.production_id) {
        return [{ kind: "noop" }];
      }
      if (ctx.publicationPolicy === "auto") {
        return [{
          kind: "auto_publish",
          episodeId: ctx.production.episode_id,
          episodeRevisionId: event.payload.episode_revision_id,
        }];
      }
      return [{ kind: "noop" }];
    default:
      return [{ kind: "noop" }];
  }
}

function commandsForProductionRequested(ctx: PolicyContext): PolicyCommand[] {
  const { production } = ctx;
  const profile = flattenProductionProfile(production.profile);
  const causation = ctx.causationEventId;

  if (production.scope === "full") {
    return [{
      kind: "request_job",
      jobType: "write_script",
      input: {
        article_content: ctx.articleContent,
        article_revision_id: production.article_revision_id,
        profile,
      },
      idempotencyKey: `write_script:${production.production_id}:${causation}`,
    }];
  }

  if (production.scope === "audio") {
    const script = ctx.baseScript;
    if (!script) {
      return [{
        kind: "production_failed",
        productionId: production.production_id,
        reason: "audio scope requires base script",
      }];
    }
    return [{
      kind: "request_job",
      jobType: "render_audio",
      input: {
        script_id: script.scriptId,
        script_content: script.content,
        profile,
      },
      idempotencyKey: `render_audio:${production.production_id}:${causation}`,
    }];
  }

  if (production.scope === "artwork") {
    const script = ctx.baseScript;
    if (!script) {
      return [{
        kind: "production_failed",
        productionId: production.production_id,
        reason: "artwork scope requires base script",
      }];
    }
    return [{
      kind: "request_job",
      jobType: "paint_artwork",
      input: {
        script_id: script.scriptId,
        title: script.title,
        description: script.description,
        article_excerpt: script.articleExcerpt,
        profile,
      },
      idempotencyKey: `paint_artwork:${production.production_id}:${causation}`,
    }];
  }

  return [{ kind: "noop" }];
}

function commandsAfterScriptWritten(
  ctx: PolicyContext,
  title: string,
  description: string,
  content: string,
): PolicyCommand[] {
  const { production } = ctx;
  const profile = flattenProductionProfile(production.profile);
  const scriptId = ctx.progress.scriptId;
  if (!scriptId) return [{ kind: "noop" }];

  const commands: PolicyCommand[] = [{
    kind: "request_job",
    jobType: "render_audio",
    input: {
      script_id: scriptId,
      script_content: content,
      profile,
    },
    idempotencyKey: `render_audio:${production.production_id}:script:${scriptId}`,
  }];

  if (isArtworkEnabled(production.profile)) {
    commands.push({
      kind: "request_job",
      jobType: "paint_artwork",
      input: {
        script_id: scriptId,
        title,
        description,
        article_excerpt: ctx.articleContent.slice(0, 500),
        profile,
      },
      idempotencyKey: `paint_artwork:${production.production_id}:script:${scriptId}`,
    });
  }

  return commands;
}
