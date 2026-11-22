import "server-only";

import path from "node:path";
import { getRepoRoot } from "../../repo-root";
import { loadDrillSets, type DrillSet } from "./load";

function jukenRoot(): string {
  return path.join(getRepoRoot(), "chugaku-juken");
}

/** 形式に誤りのある問題が 1 つでもあれば、公開せずにビルドを止める。警告は表示だけ。 */
export function loadKokugoChoiceSets(): DrillSet[] {
  const { sets, problems } = loadDrillSets(jukenRoot());
  for (const problem of problems) {
    for (const warning of problem.warnings) console.warn(`[juken/kokugo-choice] ${problem.file}: ${warning}`);
  }
  const broken = problems.filter((problem) => problem.errors.length > 0);
  if (broken.length > 0) {
    throw new Error(
      `[juken/kokugo-choice] invalid question files:\n${broken
        .map((problem) => `- ${problem.file}\n${problem.errors.map((error) => `    ${error}`).join("\n")}`)
        .join("\n")}`,
    );
  }
  return sets;
}

export function findKokugoChoiceSet(setId: string): DrillSet | null {
  return loadKokugoChoiceSets().find((set) => set.id === setId) ?? null;
}
