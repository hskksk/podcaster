#!/usr/bin/env tsx
/**
 * Validate section-visuals.yml next to index.mdoc.
 *
 *   pnpm section-visuals:validate content/docs/<slug>/index.mdoc
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import yaml from "js-yaml";
import { extractMinimapOutline } from "@hskksk/markdoc-react/server";
import { parseFrontmatter } from "../lib/mdoc.ts";
import {
  ARTICLE_VISUAL_ENGINE,
  ARTICLE_VISUAL_ENGINE_VERSION,
  validateArticleVisualSpecV1,
} from "./spec-v1.ts";

const mdocPath = process.argv[2];
if (!mdocPath) {
  console.error("usage: validate_section_visuals.ts <path/to/index.mdoc>");
  process.exit(2);
}

const abs = resolve(mdocPath);
const ymlPath = join(dirname(abs), "section-visuals.yml");
if (!existsSync(ymlPath)) {
  console.error(`missing ${ymlPath}`);
  process.exit(1);
}

const source = readFileSync(abs, "utf8");
const { body } = parseFrontmatter(source);
const expectedSha = createHash("sha256").update(body, "utf8").digest("hex");
const knownIds = new Set(extractMinimapOutline(body).sections.map((s) => s.id));

type VisualEntry = {
  sectionId?: string;
  engine?: string;
  engineVersion?: string;
  alt?: string;
  spec?: unknown;
};

type Sidecar = {
  version?: number;
  sourceSha256?: string;
  visuals?: VisualEntry[];
};

const errors: string[] = [];

let sidecar: Sidecar;
try {
  sidecar = yaml.load(readFileSync(ymlPath, "utf8")) as Sidecar;
} catch (err) {
  console.error(`failed to parse ${ymlPath}:`, err);
  process.exit(1);
}

if (sidecar.version !== 1) errors.push("version: must be 1");
if (sidecar.sourceSha256 !== expectedSha) {
  errors.push(`sourceSha256: expected ${expectedSha}, got ${sidecar.sourceSha256 ?? "(missing)"}`);
}

const visuals = sidecar.visuals;
if (!Array.isArray(visuals) || visuals.length === 0) {
  errors.push("visuals: non-empty array required");
} else {
  const seenSection = new Set<string>();
  for (const [i, v] of visuals.entries()) {
    const p = `visuals[${i}]`;
    const sectionId = v.sectionId?.trim();
    if (!sectionId) {
      errors.push(`${p}.sectionId: required`);
    } else if (!knownIds.has(sectionId)) {
      errors.push(`${p}.sectionId: "${sectionId}" not in article outline`);
    }
    if (sectionId) {
      if (seenSection.has(sectionId)) errors.push(`${p}.sectionId: duplicate "${sectionId}"`);
      seenSection.add(sectionId);
    }

    if (v.engine !== ARTICLE_VISUAL_ENGINE) {
      errors.push(`${p}.engine: must be "${ARTICLE_VISUAL_ENGINE}"`);
    }
    if (v.engineVersion !== ARTICLE_VISUAL_ENGINE_VERSION) {
      errors.push(`${p}.engineVersion: must be "${ARTICLE_VISUAL_ENGINE_VERSION}"`);
    }

    const alt = v.alt?.trim();
    if (!alt) {
      errors.push(`${p}.alt: required`);
    } else if (alt.length > 400) {
      errors.push(`${p}.alt: exceeds 400 characters`);
    }

    const specErrors: string[] = [];
    if (!validateArticleVisualSpecV1(v.spec, specErrors)) {
      for (const e of specErrors) errors.push(`${p}.${e}`);
    }
  }
}

if (errors.length) {
  for (const e of errors) console.error(e);
  process.exit(1);
}

console.log(`ok: section-visuals.yml (${visuals!.length} visuals)`);
