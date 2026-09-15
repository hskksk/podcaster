import type { ReactNode } from "react";

/** Flatten Markdoc/React children to source text (math TeX, mermaid, …). */
export function childText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(childText).join("");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return childText(props?.children);
  }
  return "";
}
