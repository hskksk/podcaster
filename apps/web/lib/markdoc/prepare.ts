import "server-only";

import Markdoc, { type RenderableTreeNodes } from "@markdoc/markdoc";

const { Tag } = Markdoc;
import { parseFrontmatter } from "../../../../scripts/lib/mdoc";
import type { TocEntry } from "../site/toc";
import markdocSchema from "../../markdoc/config";

export type PreparedMarkdoc = {
  content: RenderableTreeNodes;
  toc: TocEntry[];
};

/** RSC props must be plain objects — Markdoc.transform returns Tag class instances. */
function serializeRenderable(node: RenderableTreeNodes): RenderableTreeNodes {
  if (node == null) return node;
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map((child) => serializeRenderable(child)) as RenderableTreeNodes;
  }
  if (Tag.isTag(node)) {
    return {
      $$mdtype: "Tag",
      name: node.name,
      attributes: { ...node.attributes },
      children: node.children.map((child) => serializeRenderable(child)),
    } as RenderableTreeNodes;
  }
  return node;
}

function renderableText(node: RenderableTreeNodes): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((child) => renderableText(child)).join("");
  if (Tag.isTag(node)) return renderableText(node.children);
  return "";
}

function extractTocFromContent(content: RenderableTreeNodes): TocEntry[] {
  const entries: TocEntry[] = [];

  function walk(node: RenderableTreeNodes): void {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (!Tag.isTag(node)) return;

    if (node.name === "Heading") {
      const level = node.attributes.level;
      if (level === 2 || level === 3) {
        const id = typeof node.attributes.id === "string" ? node.attributes.id : "";
        if (id) {
          entries.push({
            id,
            text: renderableText(node.children).trim(),
            level: level as 2 | 3,
          });
        }
      }
    }

    for (const child of node.children) walk(child);
  }

  walk(content);
  return entries;
}

/**
 * Parse + transform on the server; client receives only the renderable tree.
 * SSG embeds the tree in static HTML props — very long articles can produce a
 * larger payload than raw `source`; monitor if individual pages grow huge.
 */
export function prepareMarkdoc(source: string): PreparedMarkdoc {
  const { body } = parseFrontmatter(source);
  const ast = Markdoc.parse(body);
  const content = serializeRenderable(Markdoc.transform(ast, markdocSchema));
  const toc = extractTocFromContent(content);
  return { content, toc };
}
