import { runGenerateAudioStage } from "../functions/_shared/pipeline-stages.ts"

export async function generateAudio(
  input: {
    episodeId: string;
    regenerate: boolean;
  },
) {
  await runGenerateAudioStage(input);
  return { episodeId: input.episodeId, skipped: false };
}

