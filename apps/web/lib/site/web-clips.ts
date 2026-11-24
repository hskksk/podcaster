import "server-only";

import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "../../../../scripts/lib/mdoc";
import { LEGACY_CLIPS_REL, notesDir } from "../repo-root";
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
  return notesDir();
}

function isWebClipEntry(source: string, usingLegacyDir: boolean): boolean {
  if (usingLegacyDir) return true;
  const { attrs } = parseFrontmatter(source);
  const kind = attrs.kind?.toLowerCase();
  if (kind === "web-clip") return true;
  if (kind === "memo" || kind === "idea") return false;
  return Boolean(attrs.url?.trim());
}

let publicWebClipsCache: PublicWebClip[] | undefined;

export function loadPublicWebClips(): PublicWebClip[] {
  if (publicWebClipsCache) return publicWebClipsCache;
  const root = webClipsDir();
  if (!fs.existsSync(root)) {
    console.warn(`[site] notes missing at ${root} (cwd=${process.cwd()})`);
    return [];
  }
  const usingLegacyDir = root.replace(/\\/g, "/").endsWith(`/${LEGACY_CLIPS_REL}`);
  publicWebClipsCache = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const indexPath = path.join(root, e.name, "index.mdoc");
      if (!fs.existsSync(indexPath)) return null;
      const source = fs.readFileSync(indexPath, "utf8");
      if (!isWebClipEntry(source, usingLegacyDir)) return null;
      return publicWebClipFromMdocSource(e.name, source);
    })
    .filter((a): a is PublicWebClip => a !== null)
    .sort((a, b) => b.filename.localeCompare(a.filename, "en"));
  return publicWebClipsCache;
}

export function loadPublicWebClip(slug: string): PublicWebClip | null {
  const decoded = decodeURIComponent(slug);
  return loadPublicWebClips().find((c) => c.slug === decoded) ?? null;
}
