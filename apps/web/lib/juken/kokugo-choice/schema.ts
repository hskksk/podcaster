/**
 * 国語 選択肢問題 1問のデータ形式。
 * ファイル（`qNN.json`）は作問プロンプトの出力と同じ snake_case。サイトとチェックスクリプトは
 * `parseQuestion` で camelCase の `DrillQuestion` に変換して使う。
 */

import { findEvidenceRange, parsePassage, splitEvidence } from "./passage";

export const CHOICE_IDS = ["ア", "イ", "ウ", "エ"] as const;
export type ChoiceId = (typeof CHOICE_IDS)[number];

export const GENRES = ["説明文", "随筆", "小説"] as const;
export type Genre = (typeof GENRES)[number];

export const QUESTION_TYPES = [
  "理由",
  "気持ち",
  "気持ちの変化",
  "内容合致",
  "筆者の考え",
  "言い換え",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const MODES = ["generate", "excerpt"] as const;
export type DrillMode = (typeof MODES)[number];

export const LEVELS = [1, 2, 3] as const;
export type DrillLevel = (typeof LEVELS)[number];

export const ERROR_TYPES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"] as const;
export type ErrorType = (typeof ERROR_TYPES)[number];

/** 子ども向けの短い呼び名。定義は skill の references/author-prompt.md と同じ。 */
export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  A: "本文にない",
  B: "言い過ぎ",
  C: "逆・すり替え",
  D: "部分ズレ",
  E: "問いに合わない",
  F: "一般論",
  G: "語のすり替え",
  H: "方向ちがい",
  I: "表面読み",
  J: "場面のずれ",
  K: "読み込みすぎ",
  L: "程度のずれ",
  M: "原因のズレ",
};

export const LEVEL_LABELS: Record<DrillLevel, string> = {
  1: "レベル1",
  2: "レベル2",
  3: "レベル3",
};

export const MODE_LABELS: Record<DrillMode, string> = {
  generate: "自作",
  excerpt: "抜粋",
};

export type ChoiceAnalysis = {
  correct: boolean;
  errorType: ErrorType | null;
  defect: string | null;
  /** 本文からの抜き出し。「…」でつなぐ場合は各片が本文に現れる */
  evidence: string[];
};

export type DrillQuestion = {
  /** ファイル名の stem（例 `q01`） */
  id: string;
  mode: DrillMode;
  genre: Genre;
  level: DrillLevel;
  questionType: QuestionType;
  /** 題材。次回以降の重複回避に使う */
  theme: string;
  /** 人称・時制・視点などの文体メモ */
  style: string;
  /** 傍線部は `**…**` */
  passage: string;
  source: string;
  question: string;
  choices: Record<ChoiceId, string>;
  answer: ChoiceId;
  analysis: Record<ChoiceId, ChoiceAnalysis>;
  eliminationSteps: string;
};

export type ParseResult =
  | { ok: true; question: DrillQuestion }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function oneOf<T extends string | number>(list: readonly T[], value: unknown): value is T {
  return list.includes(value as T);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseQuestion(raw: unknown, id: string): ParseResult {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ["JSON のトップレベルがオブジェクトではない"] };

  const mode = raw.mode;
  if (!oneOf(MODES, mode)) errors.push(`mode は ${MODES.join(" | ")}`);
  const genre = raw.genre;
  if (!oneOf(GENRES, genre)) errors.push(`genre は ${GENRES.join(" | ")}`);
  const level = raw.level;
  if (!oneOf(LEVELS, level)) errors.push("level は 1 | 2 | 3（数値）");
  const questionType = raw.question_type;
  if (!oneOf(QUESTION_TYPES, questionType)) errors.push(`question_type は ${QUESTION_TYPES.join(" | ")}`);

  const theme = str(raw.theme);
  if (!theme) errors.push("theme が空");
  const style = str(raw.style);
  if (!style) errors.push("style が空");
  const passage = str(raw.passage);
  if (!passage) errors.push("passage が空");
  const source = str(raw.source);
  if (!source) errors.push("source が空");
  const question = str(raw.question);
  if (!question) errors.push("question が空");
  const eliminationSteps = str(raw.elimination_steps);
  if (!eliminationSteps) errors.push("elimination_steps が空");

  const answer = raw.answer;
  if (!oneOf(CHOICE_IDS, answer)) errors.push(`answer は ${CHOICE_IDS.join(" | ")}`);

  const choices = {} as Record<ChoiceId, string>;
  const rawChoices = raw.choices;
  if (!isRecord(rawChoices)) {
    errors.push("choices がオブジェクトではない");
  } else {
    for (const key of Object.keys(rawChoices)) {
      if (!oneOf(CHOICE_IDS, key)) errors.push(`choices に不明なキー「${key}」`);
    }
    for (const key of CHOICE_IDS) {
      const text = str(rawChoices[key]);
      if (!text) errors.push(`choices.${key} が空`);
      else choices[key] = text;
    }
  }

  const analysis = {} as Record<ChoiceId, ChoiceAnalysis>;
  const rawAnalysis = raw.choice_analysis;
  if (!isRecord(rawAnalysis)) {
    errors.push("choice_analysis がオブジェクトではない");
  } else {
    for (const key of CHOICE_IDS) {
      const entry = rawAnalysis[key];
      if (!isRecord(entry)) {
        errors.push(`choice_analysis.${key} がない`);
        continue;
      }
      const verdict = entry.verdict;
      if (verdict !== "○" && verdict !== "×") {
        errors.push(`choice_analysis.${key}.verdict は ○ | ×`);
        continue;
      }
      const correct = verdict === "○";
      const rawEvidence = entry.evidence;
      const evidence = (Array.isArray(rawEvidence) ? rawEvidence : [rawEvidence])
        .map((item) => str(item))
        .filter((item): item is string => item !== null);
      if (evidence.length === 0) errors.push(`choice_analysis.${key}.evidence が空`);
      if (correct && evidence.length > 2) errors.push(`choice_analysis.${key}.evidence は正解で 1〜2 か所`);
      if (!correct && evidence.length !== 1) errors.push(`choice_analysis.${key}.evidence は誤答で 1 か所`);

      let errorType: ErrorType | null = null;
      let defect: string | null = null;
      if (correct) {
        if (entry.error_type != null) errors.push(`choice_analysis.${key}.error_type は ○ では null`);
        if (entry.defect != null) errors.push(`choice_analysis.${key}.defect は ○ では null`);
      } else {
        if (!oneOf(ERROR_TYPES, entry.error_type)) errors.push(`choice_analysis.${key}.error_type は A〜M`);
        else errorType = entry.error_type;
        defect = str(entry.defect);
        if (!defect) errors.push(`choice_analysis.${key}.defect が空`);
      }
      analysis[key] = { correct, errorType, defect, evidence };
    }
  }

  if (oneOf(CHOICE_IDS, answer) && Object.keys(analysis).length === CHOICE_IDS.length) {
    const correctIds = CHOICE_IDS.filter((key) => analysis[key]?.correct);
    if (correctIds.length !== 1 || correctIds[0] !== answer) {
      errors.push(`answer(${String(answer)}) と ○ の選択肢(${correctIds.join("、") || "なし"})が一致しない`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    question: {
      id,
      mode: mode as DrillMode,
      genre: genre as Genre,
      level: level as DrillLevel,
      questionType: questionType as QuestionType,
      theme: theme!,
      style: style!,
      passage: passage!,
      source: source!,
      question: question!,
      choices,
      answer: answer as ChoiceId,
      analysis,
      eliminationSteps: eliminationSteps!,
    },
  };
}

/** 本文の形式チェック。機械的に判定できる「作問ルール」だけを見る。 */
export function lintQuestion(question: DrillQuestion): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const marks = question.passage.split("**").length - 1;
  if (marks % 2 !== 0) errors.push("passage の ** が対になっていない");
  if (marks > 2) errors.push("傍線部（**…**）は 1 か所だけにする");
  if (question.question.includes("傍線部") && marks === 0) {
    errors.push("設問に「傍線部」とあるが、passage に ** がない");
  }
  if (marks > 0 && !question.question.includes("傍線部")) {
    warnings.push("passage に傍線部があるが、設問文に「傍線部」がない");
  }
  if (
    (question.questionType === "気持ち" || question.questionType === "気持ちの変化") &&
    marks === 0
  ) {
    errors.push("気持ちを問う設問には傍線部（**…**）が要る");
  }

  const length = plainLength(question.passage);
  if (question.mode === "generate") {
    const [min, max] = question.genre === "説明文" ? [150, 250] : [200, 300];
    if (length < min || length > max) {
      errors.push(`本文が ${length} 字（${question.genre}は ${min}〜${max} 字）`);
    }
    if (question.source !== "自作") errors.push("mode=generate の source は「自作」");
  } else if (question.source === "自作") {
    errors.push("mode=excerpt の source に作品名・作者・底本を書く");
  }

  const lengths = Object.values(question.choices).map((text) => [...text].length);
  const longest = Math.max(...lengths);
  const shortest = Math.min(...lengths);
  if (longest > shortest * 1.3) {
    warnings.push(`選択肢の長さの差が大きい（最長 ${longest} 字 / 最短 ${shortest} 字 = ${(longest / shortest).toFixed(2)} 倍）`);
  }

  const { text: plain } = parsePassage(question.passage);
  for (const key of CHOICE_IDS) {
    const entry = question.analysis[key];
    const quotes = entry.evidence.flatMap(splitEvidence);
    for (const quote of quotes) {
      if (!findEvidenceRange(plain, quote)) {
        errors.push(`choice_analysis.${key} の evidence が本文にない: 「${quote}」`);
      }
      if (!entry.correct && [...quote].length > 30) {
        warnings.push(`choice_analysis.${key} の evidence が 30 字を超える: 「${quote}」`);
      }
    }
  }

  return { errors, warnings };
}

function plainLength(passage: string): number {
  return [...parsePassage(passage).text.replace(/\s+/g, "")].length;
}
