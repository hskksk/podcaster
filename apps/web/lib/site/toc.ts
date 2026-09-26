import { parseFrontmatter } from "../../../../scripts/lib/mdoc";
import { slugifyHeading } from "./slugify";

export type TocEntry = {
  id: string;
  text: string;
  level: 2 | 3;
};

/** Build TOC from raw mdoc; ids match {@link Heading} slug rules. */
export function extractToc(source: string): TocEntry[] {
  const { body } = parseFrontmatter(source);
  const entries: TocEntry[] = [];
  const used = new Map<string, number>();

  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (!m) continue;
    const level = m[1].length as 2 | 3;
    const text = m[2].replace(/\{#.+?\}$/, "").trim();
    const base = slugifyHeading(text);
    const n = used.get(base) ?? 0;
    const id = n > 0 ? `${base}-${n + 1}` : base;
    used.set(base, n + 1);
    entries.push({ id, text, level });
  }
  return entries;
}
