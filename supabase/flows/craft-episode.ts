import { Flow } from "@pgflow/dsl";
import { generateScript } from "../tasks/generateScript.ts"
import { generateAudio } from "../tasks/generateAudio.ts"
import { updateRss } from "../tasks/updateRss.ts"

type Input = {
  episodeId: string;
  regenerate?: boolean;
  startFrom: "script" | "audio" | "rss";
  trigger?: "ingest" | "manual";
};

export const CraftEpisode = new Flow<Input>({
  slug: "craftEpisode",
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
      if (flowInput.startFrom === "audio" || flowInput.startFrom === "rss") {
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
      slug: "generateAudio",
      dependsOn: ["generateScript"],
      maxAttempts: 5,
      timeout: 900,
    },
    async (deps, ctx) => {
      const flowInput = await ctx.flowInput;
      if (flowInput.startFrom === "rss") {
        return { episodeId: flowInput.episodeId, skipped: true };
      }

      return await generateAudio({
        episodeId: flowInput.episodeId,
        regenerate: flowInput.regenerate,
      });
    },
  )
  .step(
    {
      slug: "updateRss",
      dependsOn: ["generateAudio"],
      maxAttempts: 3,
      timeout: 120,
    },
    async (deps, ctx) => {
      const flowInput = await ctx.flowInput;
      return await updateRss({
        episodeId: flowInput.episodeId,
      });
    },
  );
