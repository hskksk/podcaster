/**
 * Parse all chugaku-juken lesson .mdoc files with the juken Markdoc schema.
 */
import fs from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseLessonFile, textLabelFromFrontmatter } from "../lib/juken/lesson-meta";
import { transformJukenBody } from "../lib/juken/markdoc-transform";
import { splitLessonSource } from "../lib/juken/lesson-meta";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const jukenRoot = path.join(repoRoot, "chugaku-juken");

function collectMdocFiles(root: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(root)) return files;
  for (const school of fs.readdirSync(root, { withFileTypes: true })) {
    if (!school.isDirectory()) continue;
    const schoolPath = path.join(root, school.name);
    for (const course of fs.readdirSync(schoolPath, { withFileTypes: true })) {
      if (!course.isDirectory()) continue;
      const weeksPath = path.join(schoolPath, course.name, "weeks");
      if (!fs.existsSync(weeksPath)) continue;
      for (const week of fs.readdirSync(weeksPath, { withFileTypes: true })) {
        if (!week.isDirectory()) continue;
        const weekPath = path.join(weeksPath, week.name);
        for (const file of fs.readdirSync(weekPath, { withFileTypes: true })) {
          if (file.isFile() && file.name.endsWith(".mdoc")) {
            files.push(path.join(weekPath, file.name));
          }
        }
      }
    }
  }
  return files;
}

const files = collectMdocFiles(jukenRoot);
if (files.length === 0) {
  console.error("juken-markdoc-check: no .mdoc lessons found");
  process.exit(1);
}

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const parsed = parseLessonFile(source);
  if (!textLabelFromFrontmatter(parsed.frontmatter)) {
    console.error(`juken-markdoc-check: missing sapixText/unit in ${path.relative(repoRoot, file)}`);
    process.exit(1);
  }
  try {
    const { body } = splitLessonSource(source);
    transformJukenBody(body);
  } catch (error) {
    console.error(`juken-markdoc-check: transform failed for ${path.relative(repoRoot, file)}`, error);
    process.exit(1);
  }
}

console.log(`juken-markdoc-check: ok (${files.length} lessons)`);
