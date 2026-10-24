import type { RenderableTreeNodes } from "@markdoc/markdoc";
import Markdoc from "@markdoc/markdoc";
import { characterById } from "./characters";

const { Tag } = Markdoc;

function walkPlain(node: RenderableTreeNodes, parts: string[]): void {
  if (node == null) return;
  if (typeof node === "string") {
    const t = node.trim();
    if (t) parts.push(t);
    return;
  }
  if (typeof node === "number" || typeof node === "boolean") {
    parts.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) walkPlain(child, parts);
    return;
  }
  if (Tag.isTag(node) || (typeof node === "object" && "$$mdtype" in node && node.$$mdtype === "Tag")) {
    const tag = node as { name: string; attributes: Record<string, unknown>; children: RenderableTreeNodes[] };
    if (tag.name === "JukenSay") {
      const id = String(tag.attributes.character ?? "");
      const known = characterById(id);
      if (known) parts.push(known.name);
      const note = tag.attributes.note;
      if (typeof note === "string" && note.trim()) parts.push(note.trim());
    }
    for (const child of tag.children) walkPlain(child, parts);
  }
}

export function jukenPlainTextFromTree(content: RenderableTreeNodes): string {
  const parts: string[] = [];
  walkPlain(content, parts);
  return parts.join("\n");
}
