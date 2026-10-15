import type { flattenTreemapNodes } from "@hskksk/markdoc-react";

type FlatNode = ReturnType<typeof flattenTreemapNodes>[number];

export function nodeNeedsLabel({ node, path }: FlatNode): boolean {
  const isLeaf = node.children.length === 0;
  const title = node.title ?? "";
  const subtitleAuto = isLeaf && Boolean(node.text) && !node.subtitle?.trim();
  const looksLikeParagraphSnippet =
    isLeaf && title.length > 0 && title.length <= 30 && Boolean(node.text);
  return (
    isLeaf &&
    (subtitleAuto ||
      looksLikeParagraphSnippet ||
      (node.kind === "leaf" && path.length > 1 && title.endsWith("…")))
  );
}
