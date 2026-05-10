import { pollGeneratingAudio, startGeneratingAudio } from "../functions/_shared/pipeline-stages.ts"

export async function generateAudio(
  input: {
    episodeId: string;
    regenerate: boolean;
  },
) {
  await startGeneratingAudio(input);
  const polled = await pollGeneratingAudio({ episodeId: input.episodeId });
  if (!polled.done) {
    throw new Error(`Audio batch is still running for episode: ${input.episodeId}`);
  }
  return { episodeId: input.episodeId, skipped: false };
}

