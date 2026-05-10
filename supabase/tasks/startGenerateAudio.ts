import { startGeneratingAudio } from "../functions/_shared/pipeline-stages.ts"

export async function startGenerateAudio(
  input: {
    episodeId: string;
    regenerate?: boolean;
  },
) {
  await startGeneratingAudio(input);
  return { episodeId: input.episodeId, skipped: false };
}
