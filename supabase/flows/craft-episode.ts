import { Flow } from "@pgflow/dsl";
import { generateScript } from "../tasks/generateScript.ts"
import { startGenerateAudio } from "../tasks/startGenerateAudio.ts"
import { pollGenerateAudio } from "../tasks/pollGenerateAudio.ts"
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
      slug: "generateAudioStart",
      dependsOn: ["generateScript"],
      maxAttempts: 3,
      timeout: 60,
    },
    async (deps, ctx) => {
      const flowInput = await ctx.flowInput;
      if (flowInput.startFrom === "rss") {
        return { episodeId: flowInput.episodeId, skipped: true };
      }

      return await startGenerateAudio({
        episodeId: flowInput.episodeId,
        regenerate: flowInput.regenerate,
      });
    },
  )
  .step(
    {
      slug: "generateAudioPoll",
      dependsOn: ["generateAudioStart"],
      maxAttempts: 120,
      timeout: 30,
    },
    async (deps, ctx) => {
      const flowInput = await ctx.flowInput;
      if (flowInput.startFrom === "rss") {
        return { episodeId: flowInput.episodeId, skipped: true };
      }

      return await pollGenerateAudio({
        episodeId: flowInput.episodeId,
      });
    },
  )
  .step(
    {
      slug: "updateRss",
      dependsOn: ["generateAudioPoll"],
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
