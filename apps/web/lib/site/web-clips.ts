import "server-only";

import fs from "node:fs";
import path from "node:path";
import { getRepoRoot } from "../repo-root";
import { parseDateFromFilename, parseSlugFromFilename } from "../../../../scripts/lib/article-slug";
import { parseFrontmatter, parseTitleFromContent, textify } from "../../../../scripts/lib/mdoc";
import { sanitizePublicSlug, sanitizePublicText } from "./sanitize-content";

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
      const { attrs } = parseFrontmatter(source);
      const filename = attrs.legacyFilename || `${e.name}.md`;
      const slug = sanitizePublicSlug(parseSlugFromFilename(filename), e.name);
      const date = (attrs.clippedAt || "").slice(0, 10) || parseDateFromFilename(filename);
      const rawTitle = attrs.title || parseTitleFromContent(textify(source), slug);
      const title = sanitizePublicText(rawTitle);
      const clip: PublicWebClip = {
        dir: e.name,
        filename,
        slug,
        date,
        title,
        source,
      };
      if (attrs.url) clip.url = attrs.url;
      return clip;
    })
    .filter((a): a is PublicWebClip => a !== null)
    .sort((a, b) => b.filename.localeCompare(a.filename, "en"));
}

export function loadPublicWebClip(slug: string): PublicWebClip | null {
  const decoded = decodeURIComponent(slug);
  return loadPublicWebClips().find((c) => c.slug === decoded) ?? null;
}
