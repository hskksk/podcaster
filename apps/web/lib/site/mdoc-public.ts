import { parseDateFromFilename, parseSlugFromFilename } from "../../../../scripts/lib/article-slug";
import { parseFrontmatter, parseTitleFromContent, textify } from "../../../../scripts/lib/mdoc";
import { sanitizePublicSlug, sanitizePublicText } from "./sanitize-content";
import type { PublicDoc } from "./docs";
import type { PublicWebClip } from "./web-clips";

export function publicDocFromMdocSource(dir: string, source: string): PublicDoc {
  const { attrs } = parseFrontmatter(source);
  const filename = attrs.legacyFilename || `${dir}.md`;
  const slug = sanitizePublicSlug(parseSlugFromFilename(filename), dir);
  const date = attrs.publishedAt || parseDateFromFilename(filename);
  const rawTitle = attrs.title || parseTitleFromContent(textify(source), slug);
  const title = sanitizePublicText(rawTitle);
  const doc: PublicDoc = {
    dir,
    filename,
    slug,
    date,
    title,
    source,
  };
  if (attrs.sourceUrl) doc.sourceUrl = attrs.sourceUrl;
  return doc;
}

export function publicWebClipFromMdocSource(dir: string, source: string): PublicWebClip {
  const { attrs } = parseFrontmatter(source);
  const filename = attrs.legacyFilename || `${dir}.md`;
  const slug = sanitizePublicSlug(parseSlugFromFilename(filename), dir);
  const date = (attrs.clippedAt || "").slice(0, 10) || parseDateFromFilename(filename);
  const rawTitle = attrs.title || parseTitleFromContent(textify(source), slug);
  const title = sanitizePublicText(rawTitle);
  const clip: PublicWebClip = {
    dir,
    filename,
    slug,
    date,
    title,
    source,
  };
  if (attrs.url) clip.url = attrs.url;
  return clip;
}

export function publicPathForDocEntry(source: string, entryDir: string): string {
  return `/articles/${publicDocFromMdocSource(entryDir, source).slug}`;
}

export function publicPathForWebClipEntry(source: string, entryDir: string): string {
  return `/web-clips/${publicWebClipFromMdocSource(entryDir, source).slug}`;
}
