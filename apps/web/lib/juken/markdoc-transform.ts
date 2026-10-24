import Markdoc, { type RenderableTreeNodes } from "@markdoc/markdoc";
import { createMarkdocConfig } from "@hskksk/markdoc-react/server";
import { jukenMarkdocExtensions } from "./markdoc-extensions";

const { Tag } = Markdoc;

const jukenMarkdocConfig = createMarkdocConfig(jukenMarkdocExtensions);

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

export function transformJukenBody(body: string): RenderableTreeNodes {
  const ast = Markdoc.parse(body);
  return serializeRenderable(Markdoc.transform(ast, jukenMarkdocConfig));
}
