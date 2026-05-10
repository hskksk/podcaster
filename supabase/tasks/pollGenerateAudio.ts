import { pollGeneratingAudio } from "../functions/_shared/pipeline-stages.ts"

export async function pollGenerateAudio(
  input: {
    episodeId: string;
  },
) {
  const polled = await pollGeneratingAudio({ episodeId: input.episodeId });
  if (!polled.done) {
    throw new Error(`Audio batch not ready yet for episode: ${input.episodeId}`);
  }
  return { episodeId: input.episodeId, skipped: false };
}
