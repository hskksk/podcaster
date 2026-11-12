import "server-only";

import Markdoc, { type RenderableTreeNode } from "@markdoc/markdoc";

const { Tag } = Markdoc;

function walkChildren(children: RenderableTreeNode[], sectionIds: Set<string>): RenderableTreeNode[] {
  const out: RenderableTreeNode[] = [];
  for (const child of children) {
    const next = walk(child as RenderableTreeNode, sectionIds);
    out.push(next);
    if (Tag.isTag(next) && next.name === "Heading") {
      const sectionId = next.attributes.id;
      if (typeof sectionId === "string" && sectionIds.has(sectionId)) {
        out.push(new Tag("SectionVisualSlot", { sectionId }, []));
      }
    }
  }
  return out;
}

function walk(node: RenderableTreeNode, sectionIds: Set<string>): RenderableTreeNode {
  if (node == null || typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    return node;
  }
  if (Array.isArray(node)) {
    return walkChildren(node, sectionIds) as RenderableTreeNode;
  }
  if (Tag.isTag(node)) {
    return new Tag(node.name, node.attributes, walkChildren(node.children, sectionIds));
  }
  return node;
}

export function injectSectionVisualSlots(
  content: RenderableTreeNode,
  sectionIds: Iterable<string>,
): RenderableTreeNode {
  return walk(content, new Set(sectionIds));
}
