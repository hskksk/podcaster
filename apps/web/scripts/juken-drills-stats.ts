/**
 * 既存セットのタグ分布を集計し、新作問の割り当てに使うレポートを出す。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDrillSets } from "../lib/juken/kokugo-choice/load";
import { formatDrillStatsReport } from "../lib/juken/kokugo-choice/stats";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const jukenRoot = path.join(repoRoot, "chugaku-juken");

const { sets, problems } = loadDrillSets(jukenRoot);
for (const problem of problems) {
  for (const error of problem.errors) {
    console.error(`juken-drills-stats: ${problem.file}: ${error}`);
    process.exit(1);
  }
}

console.log(formatDrillStatsReport(jukenRoot, sets));