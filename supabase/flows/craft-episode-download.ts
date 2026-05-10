import { Flow } from "@pgflow/dsl";
import { downloadGenerateAudio } from "../tasks/downloadGenerateAudio.ts";
import { updateRss } from "../tasks/updateRss.ts";

type Input = {
  episodeId: string;
  batchName?: string;
  startFrom?: "audio" | "rss";
  trigger?: "monitor" | "manual";
};

export const CraftEpisodeDownload = new Flow<Input>({
  slug: "craftEpisodeDownload",
  maxAttempts: 1,
  timeout: 120,
  baseDelay: 5,
})
  .step(
    {
      slug: "generateAudioDownload",
      maxAttempts: 1,
      timeout: 120,
    },
    async (flowInput) => {
      if (flowInput.startFrom === "rss") {
        return { episodeId: flowInput.episodeId, skipped: true };
      }
      return await downloadGenerateAudio({
        episodeId: flowInput.episodeId,
        batchName: flowInput.batchName,
      });
    },
  )
  .step(
    {
      slug: "updateRss",
      dependsOn: ["generateAudioDownload"],
      maxAttempts: 3,
      timeout: 120,
    },
    async (_deps, ctx) => {
      const flowInput = await ctx.flowInput;
      return await updateRss({
        episodeId: flowInput.episodeId,
      });
    },
  );
