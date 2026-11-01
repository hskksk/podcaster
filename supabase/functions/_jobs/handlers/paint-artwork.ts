import {
  buildEpisodeImagePrompt,
  excerptFromArticle,
} from "../../../../shared/episode-image-prompt.ts";
import {
  generateEpisodeImageWithGemini,
  isEpisodeImageEnabled,
  storageExtensionForMime,
} from "../../_adapters/gemini/image.ts";
import { storeBlob } from "../../_adapters/storage.ts";
import { recordLlmInvocation } from "../job-db.ts";
import { resolveProfile } from "../runner.ts";
import type { JobHandler, PaintArtworkInput } from "../types.ts";

export const handlePaintArtwork: JobHandler = async (ctx) => {
  const input = ctx.job.input as PaintArtworkInput;
  const profile = await resolveProfile(input.profile as Record<string, unknown> | undefined);
  if (!isEpisodeImageEnabled(profile as Record<string, string>)) {
    return {
      outcome: "succeeded",
      output: { skipped: true, reason: "image.disabled" },
    };
  }

  const promptTemplate = typeof profile["image.prompt_template"] === "string"
    ? profile["image.prompt_template"]
    : undefined;
  const prompt = buildEpisodeImagePrompt({
    title: input.title,
    description: input.description,
    articleExcerpt: excerptFromArticle(input.article_excerpt ?? ""),
    template: promptTemplate,
  });

  const started = Date.now();
  const generated = await generateEpisodeImageWithGemini(prompt, profile as Record<string, string>);
  const ext = storageExtensionForMime(generated.mimeType);
  const stored = await storeBlob(ctx.db, {
    jobId: ctx.job.id,
    attemptId: ctx.attemptId,
    bytes: generated.bytes,
    mimeType: generated.mimeType,
    fileName: `artwork.${ext}`,
  });

  const model = String(profile["image.model"] ?? "gemini-3.1-flash-image");
  await recordLlmInvocation(ctx.db, {
    attempt_id: ctx.attemptId,
    model,
    latency_ms: Date.now() - started,
    finish_reason: "stop",
  });

  return {
    outcome: "succeeded",
    output: {
      script_id: input.script_id,
      blob_id: stored.blobId,
      storage_path: stored.storagePath,
      mime_type: stored.mimeType,
    },
  };
};
