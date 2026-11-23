/**
 * 既存セットのタグ分布を集計し、新作問の割り当てに使うレポートを出す。
 */
import { loadDrillSets } from "../lib/juken/kokugo-choice/load";
import { formatDrillStatsReport } from "../lib/juken/kokugo-choice/stats";
import { jukenDir } from "../../../scripts/lib/content-paths";

const jukenRoot = jukenDir();

const { sets, problems } = loadDrillSets(jukenRoot);
for (const problem of problems) {
  for (const error of problem.errors) {
    console.error(`juken-drills-stats: ${problem.file}: ${error}`);
    process.exit(1);
  }
}

console.log(formatDrillStatsReport(jukenRoot, sets));