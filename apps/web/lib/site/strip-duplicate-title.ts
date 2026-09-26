import { parseFrontmatter } from "../../../../scripts/lib/mdoc";

/** Remove leading `# title` when it duplicates frontmatter title (avoids double h1). */
export function mdocBodyForRender(source: string, title: string): string {
  const { body } = parseFrontmatter(source);
  const lines = body.split(/\r?\n/);
  const first = lines[0];
  if (first?.startsWith("# ")) {
    const heading = first.slice(2).trim();
    if (heading === title.trim()) {
      lines.shift();
      while (lines[0] === "") lines.shift();
    }
  }
  return lines.join("\n");
}
