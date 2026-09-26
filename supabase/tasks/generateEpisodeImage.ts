import { runGenerateEpisodeImageStage } from "../functions/_shared/pipeline-stages.ts";

export async function generateEpisodeImage(input: {
  episodeId: string;
  regenerate?: boolean;
}) {
  await runGenerateEpisodeImageStage(input);
  return { episodeId: input.episodeId, skipped: false };
}
