import "server-only";

import { jukenDir } from "../../repo-root";
import { loadDrillSets, type DrillSet } from "./load";

let kokugoChoiceSetsCache: DrillSet[] | undefined;

/** 形式に誤りのある問題が 1 つでもあれば、公開せずにビルドを止める。警告は表示だけ。 */
export function loadKokugoChoiceSets(): DrillSet[] {
  if (kokugoChoiceSetsCache) return kokugoChoiceSetsCache;
  const { sets, problems } = loadDrillSets(jukenDir());
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
  kokugoChoiceSetsCache = sets;
  return sets;
}

export function findKokugoChoiceSet(setId: string): DrillSet | null {
  return loadKokugoChoiceSets().find((set) => set.id === setId) ?? null;
}
