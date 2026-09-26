import "server-only";

import fs from "node:fs";
import path from "node:path";
import { getRepoRoot } from "../repo-root";
import { publicWebClipFromMdocSource } from "./mdoc-public";

export type PublicWebClip = {
  dir: string;
  filename: string;
  slug: string;
  date: string;
  title: string;
  /** Raw `index.mdoc` (frontmatter + body). Compiled with Markdoc at build. */
  source: string;
  url?: string;
};

function webClipsDir(): string {
  return path.join(getRepoRoot(), "content", "web-clips");
}

export function loadPublicWebClips(): PublicWebClip[] {
  const root = webClipsDir();
  if (!fs.existsSync(root)) {
    console.warn(`[site] content/web-clips missing at ${root} (cwd=${process.cwd()})`);
    return [];
  }
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const indexPath = path.join(root, e.name, "index.mdoc");
      if (!fs.existsSync(indexPath)) return null;
      const source = fs.readFileSync(indexPath, "utf8");
      return publicWebClipFromMdocSource(e.name, source);
    })
    .filter((a): a is PublicWebClip => a !== null)
    .sort((a, b) => b.filename.localeCompare(a.filename, "en"));
}

export function loadPublicWebClip(slug: string): PublicWebClip | null {
  const decoded = decodeURIComponent(slug);
  return loadPublicWebClips().find((c) => c.slug === decoded) ?? null;
}
