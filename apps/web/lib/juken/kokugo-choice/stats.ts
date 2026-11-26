import fs from "node:fs";
import path from "node:path";
import { CHARACTER_IDS, type CharacterId } from "../characters";
import { sayCharacterIdsInBody } from "../lesson-meta";
import { DRILL_DIR_NAME, type DrillSet } from "./load";
import {
  CHOICE_IDS,
  GENRES,
  LEVELS,
  MODES,
  QUESTION_TYPES,
  type DrillQuestion,
} from "./schema";

export type CountMap<K extends string | number> = Record<K, number>;

function zero<K extends string | number>(keys: readonly K[]): CountMap<K> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as CountMap<K>;
}

/** 全セットの問題をフラットにしたリスト */
export function allQuestions(sets: readonly DrillSet[]): DrillQuestion[] {
  return sets.flatMap((set) => set.questions);
}

export function tallyQuestions(questions: readonly DrillQuestion[]) {
  const genre = zero(GENRES);
  const level = zero(LEVELS);
  const questionType = zero(QUESTION_TYPES);
  const mode = zero(MODES);
  const answer = zero(CHOICE_IDS);
  for (const question of questions) {
    genre[question.genre]++;
    level[question.level]++;
    questionType[question.questionType]++;
    mode[question.mode]++;
    answer[question.answer]++;
  }
  return { genre, level, questionType, mode, answer };
}

/** ひとやすみの `{% say %}` ごとにキャラクターを数える */
export function tallyInterludeCharacters(jukenRoot: string, setIds: readonly string[]): CountMap<CharacterId> {
  const counts = zero(CHARACTER_IDS);
  const setsPath = path.join(jukenRoot, DRILL_DIR_NAME, "sets");
  for (const setId of setIds) {
    const dir = path.join(setsPath, setId);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".mdoc")) continue;
      const body = fs.readFileSync(path.join(dir, name), "utf8");
      for (const id of sayCharacterIdsInBody(body)) counts[id] += 1;
    }
  }
  return counts;
}

export type ThemeStyleEntry = { value: string; ref: string };

export function listThemesAndStyles(sets: readonly DrillSet[]) {
  const themes: ThemeStyleEntry[] = [];
  const styles: ThemeStyleEntry[] = [];
  for (const set of sets) {
    for (const question of set.questions) {
      themes.push({ value: question.theme.trim(), ref: `${set.id}/${question.id}` });
      styles.push({ value: question.style.trim(), ref: `${set.id}/${question.id}` });
    }
  }
  return { themes, styles };
}

/** 期待値より明らかに少ないタグ（作問の割り当て候補） */
export function tagsBelowFairShare<K extends string | number>(
  counts: CountMap<K>,
  keys: readonly K[],
  total: number,
): K[] {
  if (total === 0) return [...keys];
  const zeros = keys.filter((key) => counts[key] === 0);
  if (total < keys.length * 2) return zeros;
  const fair = total / keys.length;
  return [...new Set([...zeros, ...keys.filter((key) => counts[key] < fair * 0.85)])];
}

/** 発言数が期待より少ないキャラクター */
export function charactersBelowFairShare(counts: CountMap<CharacterId>): CharacterId[] {
  const total = CHARACTER_IDS.reduce((sum, id) => sum + counts[id], 0);
  const zeros = CHARACTER_IDS.filter((id) => counts[id] === 0);
  if (total < CHARACTER_IDS.length * 2) return zeros;
  return tagsBelowFairShare(counts, CHARACTER_IDS, total);
}

function bar(count: number, max: number): string {
  if (count === 0) return "—";
  const width = Math.max(1, Math.round((count / max) * 10));
  return `${"▮".repeat(width)} ${count}`;
}

function printCountBlock(
  title: string,
  labels: Record<string, string>,
  counts: CountMap<string | number>,
  keys: readonly (string | number)[],
) {
  const max = Math.max(1, ...keys.map((key) => counts[key]));
  const lines = keys.map((key) => {
    const label = labels[String(key)] ?? String(key);
    return `  ${label}: ${bar(counts[key], max)}`;
  });
  return [`${title}:`, ...lines].join("\n");
}

const MODE_LABELS: Record<(typeof MODES)[number], string> = {
  generate: "自作",
  excerpt: "抜粋",
};

/** 作問前に読む、リポジトリ全体の分布レポート（プレーンテキスト） */
export function formatDrillStatsReport(jukenRoot: string, sets: readonly DrillSet[]): string {
  const questions = allQuestions(sets);
  const tallies = tallyQuestions(questions);
  const setIds = sets.map((set) => set.id);
  const characters = tallyInterludeCharacters(jukenRoot, setIds);
  const { themes, styles } = listThemesAndStyles(sets);

  const genreLabels = Object.fromEntries(GENRES.map((g) => [g, g]));
  const levelLabels = Object.fromEntries(LEVELS.map((l) => [l, `L${l}`]));
  const typeLabels = Object.fromEntries(QUESTION_TYPES.map((t) => [t, t]));
  const modeLabels = MODE_LABELS;
  const answerLabels = Object.fromEntries(CHOICE_IDS.map((c) => [c, `正解${c}`]));
  const charLabels = Object.fromEntries(CHARACTER_IDS.map((id) => [id, id]));

  const lowGenre = tagsBelowFairShare(tallies.genre, GENRES, questions.length);
  const lowLevel = tagsBelowFairShare(tallies.level, LEVELS, questions.length);
  const lowType = tagsBelowFairShare(tallies.questionType, QUESTION_TYPES, questions.length);
  const lowMode = tagsBelowFairShare(tallies.mode, MODES, questions.length);
  const lowAnswer = tagsBelowFairShare(tallies.answer, CHOICE_IDS, questions.length);
  const lowChars = charactersBelowFairShare(characters);

  const blocks = [
    "=== 国語 選択肢問題 · タグ分布（全セット合計） ===",
    `セット ${sets.length} · 問題 ${questions.length} 問`,
    "",
    printCountBlock("genre", genreLabels, tallies.genre, GENRES),
    "",
    printCountBlock("level", levelLabels, tallies.level, LEVELS),
    "",
    printCountBlock("question_type", typeLabels, tallies.questionType, QUESTION_TYPES),
    "",
    printCountBlock("mode", modeLabels, tallies.mode, MODES),
    "",
    printCountBlock("正解位置", answerLabels, tallies.answer, CHOICE_IDS),
    "",
    printCountBlock("ぬいぐるみ（ひとやすみ発言）", charLabels, characters, CHARACTER_IDS),
    "",
    "題材 (theme) — 新セットでは使い回さない:",
    ...themes.map((entry) => `  · ${entry.value} 〔${entry.ref}〕`),
    "",
    "文体 (style) — 同じ組み合わせを避ける:",
    ...styles.map((entry) => `  · ${entry.value} 〔${entry.ref}〕`),
    "",
    "次の作問で足りていないタグ（出現が少ない）:",
    `  genre: ${lowGenre.join(" · ") || "—"}`,
    `  level: ${lowLevel.map(String).join(" · ") || "—"}`,
    `  question_type: ${lowType.join(" · ") || "—"}`,
    `  mode: ${lowMode.join(" · ") || "—"}`,
    `  正解位置: ${lowAnswer.join(" · ") || "—"}`,
    `  ぬいぐるみ: ${lowChars.join(" · ") || "—"}`,
  ];

  return blocks.join("\n");
}