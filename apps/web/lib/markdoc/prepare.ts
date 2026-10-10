import "server-only";

import Markdoc, { type RenderableTreeNodes } from "@markdoc/markdoc";

const { Tag } = Markdoc;
import { parseFrontmatter } from "../../../../scripts/lib/mdoc";
import markdocSchema from "../../markdoc/config";

export type PreparedMarkdoc = {
  content: RenderableTreeNodes;
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

/**
 * Parse + transform on the server; client receives only the renderable tree.
 * SSG embeds the tree in static HTML props — very long articles can produce a
 * larger payload than raw `source`; monitor if individual pages grow huge.
 */
export function prepareMarkdoc(source: string): PreparedMarkdoc {
  const { body } = parseFrontmatter(source);
  const ast = Markdoc.parse(body);
  const content = serializeRenderable(Markdoc.transform(ast, markdocSchema));
  return { content };
}
