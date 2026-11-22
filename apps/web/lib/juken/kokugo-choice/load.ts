import fs from "node:fs";
import path from "node:path";
import { CHOICE_IDS, GENRES, LEVELS, lintQuestion, parseQuestion, type DrillQuestion, type Genre } from "./schema";

/** `chugaku-juken/` 直下のディレクトリ名。塾・コースの木とは別系統なので、塾一覧からは除く。 */
export const DRILL_DIR_NAME = "kokugo-choice";

const SET_DIR = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})$/;
const QUESTION_FILE = /^(q\d{2})\.json$/;

export type DrillSet = {
  id: string;
  title: string;
  href: string;
  questions: DrillQuestion[];
  genreCounts: { genre: Genre; count: number }[];
  levels: number[];
};

export type LoadProblem = {
  file: string;
  errors: string[];
  warnings: string[];
};

export type LoadedDrills = {
  sets: DrillSet[];
  problems: LoadProblem[];
};

export function drillIndexHref(): string {
  return `/juken/${DRILL_DIR_NAME}`;
}

export function drillSetHref(setId: string): string {
  return `${drillIndexHref()}/${encodeURIComponent(setId)}`;
}

export function drillSetTitle(setId: string): string {
  const match = SET_DIR.exec(setId);
  if (!match) return setId;
  return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日 第${Number(match[4])}回`;
}

/** `<jukenRoot>/kokugo-choice/sets/<set-id>/qNN.json` を読む。形式の誤りは problems に集める。 */
export function loadDrillSets(jukenRoot: string): LoadedDrills {
  const setsPath = path.join(jukenRoot, DRILL_DIR_NAME, "sets");
  const sets: DrillSet[] = [];
  const problems: LoadProblem[] = [];
  if (!fs.existsSync(setsPath)) return { sets, problems };

  for (const dir of fs.readdirSync(setsPath, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const rel = path.join(DRILL_DIR_NAME, "sets", dir.name);
    if (!SET_DIR.test(dir.name)) {
      problems.push({ file: rel, errors: ["セットのディレクトリ名は YYYY-MM-DD-NN"], warnings: [] });
      continue;
    }

    const questions: DrillQuestion[] = [];
    const files = fs
      .readdirSync(path.join(setsPath, dir.name), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
    for (const name of files) {
      const file = path.join(rel, name);
      const match = QUESTION_FILE.exec(name);
      if (!match) {
        problems.push({ file, errors: ["問題ファイルの名前は qNN.json"], warnings: [] });
        continue;
      }
      let raw: unknown;
      try {
        raw = JSON.parse(fs.readFileSync(path.join(setsPath, dir.name, name), "utf8"));
      } catch (error) {
        problems.push({ file, errors: [`JSON として読めない: ${String(error)}`], warnings: [] });
        continue;
      }
      const parsed = parseQuestion(raw, match[1]!);
      if (!parsed.ok) {
        problems.push({ file, errors: parsed.errors, warnings: [] });
        continue;
      }
      const lint = lintQuestion(parsed.question);
      if (lint.errors.length > 0 || lint.warnings.length > 0) {
        problems.push({ file, errors: lint.errors, warnings: lint.warnings });
      }
      if (lint.errors.length === 0) questions.push(parsed.question);
    }

    if (questions.length === 0) {
      problems.push({ file: rel, errors: ["有効な問題がない"], warnings: [] });
      continue;
    }

    sets.push({
      id: dir.name,
      title: drillSetTitle(dir.name),
      href: drillSetHref(dir.name),
      questions,
      genreCounts: GENRES.map((genre) => ({
        genre,
        count: questions.filter((question) => question.genre === genre).length,
      })).filter((entry) => entry.count > 0),
      levels: LEVELS.filter((level) => questions.some((question) => question.level === level)),
    });
  }

  sets.sort((a, b) => b.id.localeCompare(a.id));
  return { sets, problems };
}

/** 解答位置の分布（チェックスクリプトの警告用）。 */
export function answerPositionCounts(questions: readonly DrillQuestion[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(CHOICE_IDS.map((id) => [id, 0]));
  for (const question of questions) counts[question.answer] = (counts[question.answer] ?? 0) + 1;
  return counts;
}
