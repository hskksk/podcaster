import "server-only";

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { parseFrontmatter } from "../../../../scripts/lib/mdoc";
import { getRepoRoot } from "../repo-root";
import type { TreemapLabels } from "./treemap-labels-types";

export type { TreemapLabelEntry, TreemapLabels } from "./treemap-labels-types";

type TreemapSidecar = {
  version?: number;
  sourceSha256?: string;
  nodes?: TreemapLabels;
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
  treemapSource: string,
): string[] {
  const shas = new Set<string>();
  shas.add(bodySha256(parseFrontmatter(treemapSource).body));

  const indexPath = path.join(collectionRoot(collection), dir, "index.mdoc");
  if (existsSync(indexPath)) {
    const fileSource = readFileSync(indexPath, "utf8");
    shas.add(bodySha256(parseFrontmatter(fileSource).body));
  }

  return [...shas];
}

/** Load `treemap.yml` when present and `sourceSha256` matches the article body. */
export function loadTreemapLabels(
  collection: "docs" | "web-clips",
  dir: string,
  treemapSource: string,
): TreemapLabels | null {
  const ymlPath = path.join(collectionRoot(collection), dir, "treemap.yml");
  if (!existsSync(ymlPath)) return null;

  let sidecar: TreemapSidecar;
  try {
    sidecar = yaml.load(readFileSync(ymlPath, "utf8")) as TreemapSidecar;
  } catch (err) {
    console.warn(`[treemap] failed to parse ${ymlPath}:`, err);
    return null;
  }

  if (sidecar.version !== 1 || !sidecar.sourceSha256 || !sidecar.nodes) {
    console.warn(`[treemap] invalid sidecar at ${ymlPath}`);
    return null;
  }

  const valid = shaCandidates(collection, dir, treemapSource);
  if (!valid.includes(sidecar.sourceSha256)) {
    console.warn(
      `[treemap] sourceSha256 mismatch for ${dir} (sidecar stale; regenerate treemap.yml)`,
    );
    return null;
  }

  return sidecar.nodes;
}
