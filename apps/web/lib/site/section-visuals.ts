import "server-only";

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import {
  ARTICLE_VISUAL_ENGINE,
  ARTICLE_VISUAL_ENGINE_VERSION,
  parseArticleVisualSpecV1,
} from "@hskksk/markdoc-react/section-visual";
import { extractMinimapOutline } from "@hskksk/markdoc-react";
import { parseFrontmatter } from "../../../../scripts/lib/mdoc";
import { getRepoRoot } from "../repo-root";
import type { SectionVisualEntry, SectionVisualsContent } from "./section-visuals-types";

export type { SectionVisualEntry, SectionVisualsContent } from "./section-visuals-types";

type SidecarFile = {
  version?: number;
  sourceSha256?: string;
  visuals?: {
    sectionId?: string;
    engine?: string;
    engineVersion?: string;
    alt?: string;
    spec?: unknown;
  }[];
};

function bodySha256(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

function collectionRoot(collection: "docs" | "web-clips"): string {
  return path.join(getRepoRoot(), "content", collection);
}

function shaCandidates(
  collection: "docs" | "web-clips",
  dir: string,
  renderSource: string,
): string[] {
  const shas = new Set<string>();
  shas.add(bodySha256(parseFrontmatter(renderSource).body));

  const indexPath = path.join(collectionRoot(collection), dir, "index.mdoc");
  if (existsSync(indexPath)) {
    const fileSource = readFileSync(indexPath, "utf8");
    shas.add(bodySha256(parseFrontmatter(fileSource).body));
  }

  return [...shas];
}

export function loadSectionVisualsSidecar(
  collection: "docs" | "web-clips",
  dir: string,
  renderSource: string,
): SectionVisualsContent | null {
  const ymlPath = path.join(collectionRoot(collection), dir, "section-visuals.yml");
  if (!existsSync(ymlPath)) return null;

  let sidecar: SidecarFile;
  try {
    sidecar = yaml.load(readFileSync(ymlPath, "utf8")) as SidecarFile;
  } catch (err) {
    console.warn(`[section-visuals] failed to parse ${ymlPath}:`, err);
    return null;
  }

  if (sidecar.version !== 1 || !sidecar.sourceSha256 || !sidecar.visuals?.length) {
    console.warn(`[section-visuals] invalid sidecar at ${ymlPath}`);
    return null;
  }

  const validSha = shaCandidates(collection, dir, renderSource);
  if (!validSha.includes(sidecar.sourceSha256)) {
    console.warn(`[section-visuals] sourceSha256 mismatch for ${dir} (stale sidecar)`);
    return null;
  }

  const { body } = parseFrontmatter(renderSource);
  const knownIds = new Set(extractMinimapOutline(body).sections.map((s) => s.id));
  const bySectionId: Record<string, SectionVisualEntry> = {};
  const visuals: SectionVisualEntry[] = [];

  for (const [i, raw] of sidecar.visuals.entries()) {
    const sectionId = raw.sectionId?.trim();
    const alt = raw.alt?.trim();
    if (!sectionId || !alt) continue;
    if (!knownIds.has(sectionId)) {
      console.warn(`[section-visuals] drop visuals[${i}]: unknown sectionId ${sectionId}`);
      continue;
    }
    if (raw.engine !== ARTICLE_VISUAL_ENGINE || raw.engineVersion !== ARTICLE_VISUAL_ENGINE_VERSION) {
      console.warn(`[section-visuals] drop visuals[${i}]: unsupported engine`);
      continue;
    }
    const parsed = parseArticleVisualSpecV1(raw.spec);
    if (!parsed.ok) {
      console.warn(`[section-visuals] drop visuals[${i}]: ${parsed.errors.join("; ")}`);
      continue;
    }
    if (bySectionId[sectionId]) continue;
    const entry: SectionVisualEntry = {
      sectionId,
      engine: ARTICLE_VISUAL_ENGINE,
      engineVersion: ARTICLE_VISUAL_ENGINE_VERSION,
      alt,
      spec: parsed.spec,
    };
    visuals.push(entry);
    bySectionId[sectionId] = entry;
  }

  if (visuals.length === 0) return null;

  return { sourceSha256: sidecar.sourceSha256, visuals, bySectionId };
}
