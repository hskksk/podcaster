/**
 * Validate chugaku-juken/kokugo-choice question files (schema, 本文との照合, 形式ルール).
 * Errors fail the check; warnings are printed only.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { answerPositionCounts, loadDrillSets } from "../lib/juken/kokugo-choice/load";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const jukenRoot = path.join(repoRoot, "chugaku-juken");

const { sets, problems } = loadDrillSets(jukenRoot);

let failed = false;
for (const problem of problems) {
  for (const error of problem.errors) {
    failed = true;
    console.error(`juken-drills-check: ERROR ${problem.file}: ${error}`);
  }
  for (const warning of problem.warnings) {
    console.warn(`juken-drills-check: warn  ${problem.file}: ${warning}`);
  }
}

const themes = new Map<string, string>();
for (const set of sets) {
  const counts = answerPositionCounts(set.questions);
  const limit = Math.ceil(set.questions.length / 2);
  for (const [position, count] of Object.entries(counts)) {
    if (set.questions.length >= 4 && count > limit) {
      console.warn(`juken-drills-check: warn  ${set.id}: 正解が「${position}」に偏っている（${count}/${set.questions.length}）`);
    }
  }
  for (const question of set.questions) {
    const key = question.theme.trim();
    const earlier = themes.get(key);
    if (earlier) {
      console.warn(`juken-drills-check: warn  ${set.id}/${question.id}: 題材「${key}」が ${earlier} と重複`);
    } else {
      themes.set(key, `${set.id}/${question.id}`);
    }
  }
}

if (failed) process.exit(1);
const total = sets.reduce((sum, set) => sum + set.questions.length, 0);
console.log(`juken-drills-check: ok (${sets.length} sets, ${total} questions)`);
