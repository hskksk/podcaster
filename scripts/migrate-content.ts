#!/usr/bin/env tsx
/**
 * Phase 1b: move articles/*.md → content/docs/{basename}/index.mdoc
 *           inbox/*.md     → content/web-clips/{basename}/index.mdoc
 *
 * git mv first (history), then add frontmatter and mechanical math/mermaid tags.
 * Aborts unless textify(mdoc) === original markdown for every file.
 *
 *   pnpm tsx scripts/migrate-content.ts --self-test
 *   pnpm tsx scripts/migrate-content.ts --verify
 *   pnpm tsx scripts/migrate-content.ts
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  parseClippedAtFromFilename,
  parseDateFromFilename,
  parseSlugFromFilename,
} from "./lib/article-slug.ts";
import {
  markdownToMdoc,
  parseTitleFromContent,
  roundtripCheck,
  textify,
  wrapMdoc,
  type RoundtripFailure,
} from "./lib/mdoc.ts";

const ROOT = path.resolve(".");
const ARTICLES_DIR = path.join(ROOT, "articles");
const INBOX_DIR = path.join(ROOT, "inbox");
const DOCS_DIR = path.join(ROOT, "content", "docs");
const CLIPS_DIR = path.join(ROOT, "content", "web-clips");

type Job = {
  src: string;
  dest: string;
  collection: "docs" | "web-clips";
  basename: string;
};

function listMarkdown(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => path.join(dir, f));
}

function jobs(): Job[] {
  const out: Job[] = [];
  for (const src of listMarkdown(ARTICLES_DIR)) {
    const basename = path.basename(src, ".md");
    out.push({
      src,
      dest: path.join(DOCS_DIR, basename, "index.mdoc"),
      collection: "docs",
      basename,
    });
  }
  for (const src of listMarkdown(INBOX_DIR)) {
    const basename = path.basename(src, ".md");
    out.push({
      src,
      dest: path.join(CLIPS_DIR, basename, "index.mdoc"),
      collection: "web-clips",
      basename,
    });
  }
  return out;
}

function buildMdoc(job: Job, md: string): string {
  const legacyFilename = `${job.basename}.md`;
  const title = parseTitleFromContent(md, parseSlugFromFilename(legacyFilename));
  const body = markdownToMdoc(md);
  if (job.collection === "docs") {
    return wrapMdoc(
      {
        title,
        publishedAt: parseDateFromFilename(legacyFilename) || undefined,
        podcast: "published",
        legacyFilename,
      },
      body,
    );
  }
  return wrapMdoc(
    {
      title,
      clippedAt: parseClippedAtFromFilename(legacyFilename) || undefined,
      podcast: "none",
      legacyFilename,
    },
    body,
  );
}

function snippet(s: string, at: number): string {
  return JSON.stringify(s.slice(Math.max(0, at - 24), at + 48));
}

function selfTest(): void {
  const cases: Array<{ name: string; md: string }> = [
    { name: "inline math stays dollars", md: "正整数 $n$ から出発し、$n = 6$ となる。\n" },
    { name: "display same-line", md: "$$V_n = \\frac{\\pi^{n/2}}{\\Gamma(n/2 + 1)}$$\n" },
    {
      name: "display multiline",
      md: "$$\nf(n) = \\begin{cases}\nn/2\n\\end{cases}\n$$\n",
    },
    { name: "fraction $3/4$", md: "平均的に 2 ステップで $3/4$ 倍。\n" },
    { name: "$HOME not math", md: "Set $HOME and $TERM then go.\n" },
    {
      name: "currency table two dollars",
      md: "| Pro | $X/月 | トライアル（$20分のトークンクレジット） |\n",
    },
    { name: "inline code dollar", md: "Use `$HOME` and `$TERM` in the shell.\n" },
    {
      name: "code fence keeps tags and dollars",
      md: "```javascript\n{% tag_name attribute=\"value\" %}\nconst x = $n$\n```\n",
    },
    {
      name: "inline markdoc example",
      md: "`{% tag_name attribute=\"value\" %}` と `{% image /%}` 形式。\n",
    },
    {
      name: "display in blockquote stays dollars",
      md: "> **定理**\n>\n> $$\n> x = 1\n> $$\n>\n> 続く\n",
    },
    {
      name: "display with trailing fullwidth paren stays dollars",
      md: "$$-1 = 1$$（注）\n",
    },
  ];

  let failed = 0;
  for (const c of cases) {
    const mdoc = wrapMdoc(
      { title: c.name, podcast: "none", legacyFilename: "x.md" },
      markdownToMdoc(c.md),
    );
    const err = roundtripCheck(c.md, mdoc, c.name);
    if (err) {
      failed++;
      const restored = textify(mdoc);
      console.error(`FAIL ${c.name} at ${err.firstDiff}`);
      console.error(" original:", snippet(c.md, err.firstDiff));
      console.error(" textify :", snippet(restored, err.firstDiff));
    } else {
      console.log(`ok  ${c.name}`);
    }
  }
  if (failed > 0) {
    console.error(`self-test: ${failed} failed`);
    process.exit(1);
  }
  const inlineBody = markdownToMdoc("正整数 $n$ から。\n");
  if (inlineBody.includes("{% math")) {
    console.error("FAIL inline $ must not become {% math %} (Keystatic wrapper is block-only)");
    process.exit(1);
  }
  const bq = markdownToMdoc("> $$\n> x\n> $$\n");
  if (bq.includes("{% math")) {
    console.error("FAIL blockquote $$ must not become {% math %}");
    process.exit(1);
  }
  console.log("ok  blockquote $$ remains dollar");
  const d2Md = "```d2\nx -> y\n```\n";
  const d2Mdoc = markdownToMdoc(d2Md);
  const d2Err = roundtripCheck(d2Md, d2Mdoc, "self-test/d2.md");
  if (d2Err) {
    console.error("FAIL d2 fence roundtrip");
    process.exit(1);
  }
  console.log("ok  d2 fence roundtrip");
  console.log(`self-test: ${cases.length} passed`);
}

function verify(list: Job[]): RoundtripFailure[] {
  const failures: RoundtripFailure[] = [];
  for (const job of list) {
    const md = fs.readFileSync(job.src, "utf8");
    const mdoc = buildMdoc(job, md);
    const err = roundtripCheck(md, mdoc, path.relative(ROOT, job.src));
    if (err) failures.push(err);
  }
  return failures;
}

function printFailures(failures: RoundtripFailure[]): void {
  for (const err of failures) {
    const abs = path.join(ROOT, err.path);
    const md = fs.readFileSync(abs, "utf8");
    const job = jobs().find((j) => path.relative(ROOT, j.src) === err.path);
    if (!job) continue;
    const restored = textify(buildMdoc(job, md));
    console.error(`FAIL ${err.path} orig=${err.originalLen} textify=${err.textifyLen} firstDiff=${err.firstDiff}`);
    console.error(" original:", snippet(md, err.firstDiff));
    console.error(" textify :", snippet(restored, err.firstDiff));
  }
}

function migrate(list: Job[]): void {
  for (const job of list) {
    const md = fs.readFileSync(job.src, "utf8");
    const mdoc = buildMdoc(job, md);
    fs.mkdirSync(path.dirname(job.dest), { recursive: true });
    execFileSync("git", ["mv", job.src, job.dest], { stdio: "inherit" });
    fs.writeFileSync(job.dest, mdoc);
    console.log(`moved ${path.relative(ROOT, job.src)} → ${path.relative(ROOT, job.dest)}`);
  }
  for (const keep of [path.join(DOCS_DIR, ".gitkeep"), path.join(CLIPS_DIR, ".gitkeep")]) {
    if (fs.existsSync(keep)) {
      execFileSync("git", ["rm", "-f", keep], { stdio: "inherit" });
    }
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    selfTest();
    return;
  }
  const list = jobs();
  if (list.length === 0) {
    console.error("No articles/*.md or inbox/*.md to migrate.");
    process.exit(1);
  }
  console.log(`checking ${list.length} files...`);
  const failures = verify(list);
  if (failures.length > 0) {
    printFailures(failures);
    console.error(`roundtrip failed for ${failures.length} file(s)`);
    process.exit(1);
  }
  console.log(`roundtrip ok for ${list.length} files`);
  if (args.includes("--verify")) return;
  migrate(list);
  console.log("done");
}

main();
