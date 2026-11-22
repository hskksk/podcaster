/**
 * Validate chugaku-juken/kokugo-choice question files (schema, 本文との照合, 形式ルール).
 * Errors fail the check; warnings are printed only.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHARACTER_IDS } from "../lib/juken/characters";
import { answerPositionCounts, loadDrillSets } from "../lib/juken/kokugo-choice/load";
import {
  charactersBelowFairShare,
  tallyInterludeCharacters,
  tallyQuestions,
} from "../lib/juken/kokugo-choice/stats";

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
const styles = new Map<string, string>();
for (const set of sets) {
  const counts = answerPositionCounts(set.questions);
  const limit = Math.ceil(set.questions.length / 2);
  for (const [position, count] of Object.entries(counts)) {
    if (set.questions.length >= 4 && count > limit) {
      console.warn(`juken-drills-check: warn  ${set.id}: 正解が「${position}」に偏っている（${count}/${set.questions.length}）`);
    }
  }

  for (let index = 1; index < set.questions.length; index++) {
    const prev = set.questions[index - 1]!;
    const next = set.questions[index]!;
    if (prev.questionType === next.questionType) {
      console.warn(
        `juken-drills-check: warn  ${set.id}: ${prev.id} と ${next.id} で question_type「${next.questionType}」が連続している`,
      );
    }
  }

  const setTallies = tallyQuestions(set.questions);
  if (set.questions.length >= 4) {
    const genreMax = Math.max(...Object.values(setTallies.genre));
    if (genreMax >= 3 && genreMax > Math.ceil(set.questions.length / 2)) {
      console.warn(`juken-drills-check: warn  ${set.id}: セット内で genre が偏っている`);
    }
  }

  for (const question of set.questions) {
    const themeKey = question.theme.trim();
    const earlierTheme = themes.get(themeKey);
    if (earlierTheme) {
      console.warn(`juken-drills-check: warn  ${set.id}/${question.id}: 題材「${themeKey}」が ${earlierTheme} と重複`);
    } else {
      themes.set(themeKey, `${set.id}/${question.id}`);
    }

    const styleKey = question.style.trim();
    const earlierStyle = styles.get(styleKey);
    if (earlierStyle) {
      console.warn(`juken-drills-check: warn  ${set.id}/${question.id}: 文体「${styleKey}」が ${earlierStyle} と同一`);
    } else {
      styles.set(styleKey, `${set.id}/${question.id}`);
    }
  }
}

const characterCounts = tallyInterludeCharacters(
  jukenRoot,
  sets.map((set) => set.id),
);
const sayTotal = CHARACTER_IDS.reduce((sum, id) => sum + characterCounts[id], 0);
if (sayTotal >= 9) {
  const low = charactersBelowFairShare(characterCounts);
  if (low.length > 0) {
    console.warn(`juken-drills-check: warn  ぬいぐるみの発言が少ない: ${low.join(", ")}（pnpm juken:drills-stats で全体分布を確認）`);
  }
  const max = Math.max(...CHARACTER_IDS.map((id) => characterCounts[id]));
  const min = Math.min(...CHARACTER_IDS.map((id) => characterCounts[id]));
  if (min === 0) {
    console.warn(`juken-drills-check: warn  ひとやすみで一度も出ていないキャラクターがある（pnpm juken:drills-stats を参照）`);
  } else if (max >= min * 2.5 && sayTotal >= 18) {
    console.warn(`juken-drills-check: warn  ぬいぐるみの登場が偏っている（最大 ${max} / 最小 ${min}）`);
  }
}

if (failed) process.exit(1);
const total = sets.reduce((sum, set) => sum + set.questions.length, 0);
console.log(`juken-drills-check: ok (${sets.length} sets, ${total} questions)`);