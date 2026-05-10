import { runUpdateRssStage } from "../functions/_shared/pipeline-stages.ts"

export async function updateRss(
  input: {
    episodeId: string;
  },
) {
  await runUpdateRssStage(input);
  return { episodeId: input.episodeId, skipped: false };
}


