import { downloadGeneratedAudio } from "../functions/_shared/pipeline-stages.ts";

export async function downloadGenerateAudio(
  input: {
    episodeId: string;
    batchName?: string;
  },
) {
  const downloaded = await downloadGeneratedAudio({
    episodeId: input.episodeId,
    batchName: input.batchName,
  });
  if (!downloaded.done) {
    throw new Error(`Audio batch is not ready for episode: ${input.episodeId}`);
  }
  return { episodeId: input.episodeId, skipped: false };
}
