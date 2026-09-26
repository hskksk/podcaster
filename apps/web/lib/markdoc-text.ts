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

function isReactElement(node: unknown): node is { props?: { children?: ReactNode } } {
  return typeof node === "object" && node !== null && "props" in node;
}

/**
 * Markdoc turns diagram bodies into `<p>` nodes; soft breaks become `" "` strings.
 * Mermaid/D2 need real newlines restored.
 */
export function childDiagramSource(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    if (node.some(isReactElement)) {
      return node
        .map(childDiagramSource)
        .map((s) => s.trimEnd())
        .filter((s) => s.length > 0)
        .join("\n");
    }
    let out = "";
    for (const child of node) {
      if (typeof child === "string") {
        if (child === " ") out += "\n";
        else out += child;
      } else {
        out += childDiagramSource(child);
      }
    }
    return out;
  }
  if (isReactElement(node)) return childDiagramSource(node.props?.children);
  return "";
}
