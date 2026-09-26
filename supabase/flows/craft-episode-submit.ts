import { Flow } from "@pgflow/dsl";
import { generateScript } from "../tasks/generateScript.ts";
import { generateEpisodeImage } from "../tasks/generateEpisodeImage.ts";
import { startGenerateAudio } from "../tasks/startGenerateAudio.ts";

type Input = {
  episodeId: string;
  regenerate?: boolean;
  startFrom?: "script" | "audio" | "image";
  trigger?: "ingest" | "manual";
};

export const CraftEpisodeSubmit = new Flow<Input>({
  slug: "craftEpisodeSubmit",
  maxAttempts: 3,
  timeout: 120,
  baseDelay: 5,
})
  .step(
    {
      slug: "generateScript",
      maxAttempts: 3,
      timeout: 180,
    },
    async (flowInput) => {
      if (flowInput.startFrom === "audio" || flowInput.startFrom === "image") {
        return { episodeId: flowInput.episodeId, skipped: true };
      }

      return await generateScript({
        episodeId: flowInput.episodeId,
        regenerate: flowInput.regenerate,
      });
    },
  )
  .step(
    {
      slug: "generateEpisodeImage",
      dependsOn: ["generateScript"],
      maxAttempts: 3,
      timeout: 180,
    },
    async (flowInput) => {
      if (flowInput.startFrom === "audio") {
        return { episodeId: flowInput.episodeId, skipped: true };
      }
      return await generateEpisodeImage({
        episodeId: flowInput.episodeId,
        regenerate: flowInput.startFrom === "image" || flowInput.regenerate === true,
      });
    },
  )
  .step(
    {
      slug: "generateAudioStart",
      dependsOn: ["generateScript"],
      maxAttempts: 3,
      timeout: 60,
    },
    async (_deps, ctx) => {
      const flowInput = await ctx.flowInput;
      if (flowInput.startFrom === "image") {
        return { episodeId: flowInput.episodeId, skipped: true };
      }
      return await startGenerateAudio({
        episodeId: flowInput.episodeId,
        regenerate: flowInput.regenerate,
      });
    },
  );
