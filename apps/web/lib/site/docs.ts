import "server-only";

import fs from "node:fs";
import path from "node:path";
import { getRepoRoot } from "../repo-root";
import { parseDateFromFilename, parseSlugFromFilename } from "../../../../scripts/lib/article-slug";
import { parseFrontmatter, parseTitleFromContent, textify } from "../../../../scripts/lib/mdoc";

export type PublicDoc = {
  dir: string;
  filename: string;
  slug: string;
  date: string;
  title: string;
  /** Raw `index.mdoc` (frontmatter + body). Compiled with Markdoc at build. */
  source: string;
  sourceUrl?: string;
};

function docsDir(): string {
  return path.join(getRepoRoot(), "content", "docs");
}

export function loadPublicDocs(): PublicDoc[] {
  const root = docsDir();
  if (!fs.existsSync(root)) {
    console.warn(`[site] content/docs missing at ${root} (cwd=${process.cwd()})`);
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
      const slug = parseSlugFromFilename(filename);
      const date = attrs.publishedAt || parseDateFromFilename(filename);
      const title = attrs.title || parseTitleFromContent(textify(source), slug);
      const doc: PublicDoc = {
        dir: e.name,
        filename,
        slug,
        date,
        title,
        source,
      };
      if (attrs.sourceUrl) doc.sourceUrl = attrs.sourceUrl;
      return doc;
    })
    .filter((a): a is PublicDoc => a !== null)
    .sort((a, b) => b.filename.localeCompare(a.filename, "en"));
}

export function loadPublicDoc(slug: string): PublicDoc | null {
  const decoded = decodeURIComponent(slug);
  return loadPublicDocs().find((d) => d.slug === decoded) ?? null;
}
