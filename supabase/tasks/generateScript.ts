import { runGenerateScriptStage } from "../functions/_shared/pipeline-stages.ts"

export async function generateScript(
  input: {
    episodeId: string;
    regenerate: boolean;
  },
) {
  await runGenerateScriptStage(input);
  return { episodeId: input.episodeId, skipped: false };
}
