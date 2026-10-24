/**
 * Parse all chugaku-juken lesson .mdoc files with the juken Markdoc schema.
 */
import fs from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseLessonFile,
  sayCharacterIdsInBody,
  splitLessonSource,
  textLabelFromFrontmatter,
} from "../lib/juken/lesson-meta";
import { transformJukenBody } from "../lib/juken/markdoc-transform";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const jukenRoot = path.join(repoRoot, "chugaku-juken");
const WEEK_DIR = /^(\d{4}-\d{2}-\d{2})$/;

type WeekBundle = {
  week: string;
  mondayCast: string[] | null;
  files: string[];
};

function collectWeekBundles(root: string): WeekBundle[] {
  const bundles: WeekBundle[] = [];
  if (!fs.existsSync(root)) return bundles;
  for (const school of fs.readdirSync(root, { withFileTypes: true })) {
    if (!school.isDirectory()) continue;
    const schoolPath = path.join(root, school.name);
    for (const course of fs.readdirSync(schoolPath, { withFileTypes: true })) {
      if (!course.isDirectory()) continue;
      const weeksPath = path.join(schoolPath, course.name, "weeks");
      if (!fs.existsSync(weeksPath)) continue;
      for (const week of fs.readdirSync(weeksPath, { withFileTypes: true })) {
        if (!week.isDirectory() || !WEEK_DIR.test(week.name)) continue;
        const weekPath = path.join(weeksPath, week.name);
        const files = fs
          .readdirSync(weekPath, { withFileTypes: true })
          .filter((entry) => entry.isFile() && entry.name.endsWith(".mdoc"))
          .map((entry) => path.join(weekPath, entry.name));
        if (files.length === 0) continue;
        bundles.push({ week: week.name, mondayCast: null, files });
      }
    }
  }
  return bundles;
}

const bundles = collectWeekBundles(jukenRoot);
const allFiles = bundles.flatMap((b) => b.files);

if (allFiles.length === 0) {
  console.error("juken-markdoc-check: no .mdoc lessons found");
  process.exit(1);
}

for (const bundle of bundles) {
  const mondayFile = bundle.files.find((f) => f.includes("月曜_"));
  if (!mondayFile) {
    console.error(`juken-markdoc-check: no Monday lesson in week ${bundle.week}`);
    process.exit(1);
  }
  const mondayParsed = parseLessonFile(readFileSync(mondayFile, "utf8"));
  const weekCast = mondayParsed.frontmatter.weekCast;
  if (!weekCast) {
    console.error(`juken-markdoc-check: missing weekCast on ${path.relative(repoRoot, mondayFile)}`);
    process.exit(1);
  }
  if (weekCast.length !== 4) {
    console.error(`juken-markdoc-check: weekCast must have 4 ids on ${path.relative(repoRoot, mondayFile)}`);
    process.exit(1);
  }
  const allowed = new Set<string>(weekCast);

  for (const file of bundle.files) {
    const source = readFileSync(file, "utf8");
    const parsed = parseLessonFile(source);
    if (!textLabelFromFrontmatter(parsed.frontmatter)) {
      console.error(`juken-markdoc-check: missing textCode/unit in ${path.relative(repoRoot, file)}`);
      process.exit(1);
    }

    if (parsed.frontmatter.weekCast && !file.includes("月曜_")) {
      console.error(`juken-markdoc-check: weekCast only allowed on Monday file: ${path.relative(repoRoot, file)}`);
      process.exit(1);
    }
    const speakers = sayCharacterIdsInBody(parsed.body);
    for (const id of speakers) {
      if (!allowed.has(id)) {
        console.error(
          `juken-markdoc-check: character "${id}" not in week cast for ${bundle.week} (${path.relative(repoRoot, file)})`,
        );
        process.exit(1);
      }
    }
    for (const id of Object.keys(parsed.frontmatter.cast)) {
      if (!allowed.has(id)) {
        console.error(
          `juken-markdoc-check: cast key "${id}" not in week cast for ${bundle.week} (${path.relative(repoRoot, file)})`,
        );
        process.exit(1);
      }
    }

    try {
      const { body } = splitLessonSource(source);
      transformJukenBody(body);
    } catch (error) {
      console.error(`juken-markdoc-check: transform failed for ${path.relative(repoRoot, file)}`, error);
      process.exit(1);
    }
  }
}

console.log(`juken-markdoc-check: ok (${allFiles.length} lessons)`);
