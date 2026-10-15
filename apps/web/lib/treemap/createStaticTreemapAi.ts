import type { TreemapLabels } from "../site/treemap-labels-types";

/** Feed treemap.yml subtitles through markdoc-react's describeNodes (avoids fighting internal re-renders). */
export function createStaticTreemapAi(labels: TreemapLabels | null | undefined) {
  if (!labels || Object.keys(labels).length === 0) return undefined;

  return {
    async describeNodes(
      nodes: { id: string }[],
      { signal }: { signal: AbortSignal },
    ): Promise<Record<string, { subtitle: string }>> {
      if (signal.aborted) return {};
      const out: Record<string, { subtitle: string }> = {};
      for (const node of nodes) {
        const subtitle = labels[node.id]?.subtitle?.trim();
        if (subtitle) out[node.id] = { subtitle };
      }
      return out;
    },
    async inferLinks() {
      return [];
    },
    async labelChapterFlow() {
      return [];
    },
    async summarizeDoc() {
      return "";
    },
  };
}
