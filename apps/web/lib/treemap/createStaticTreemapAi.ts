import type { TreemapSidecarContent } from "../site/treemap-labels-types";

/** Feed treemap.yml through markdoc-react AI hooks (no runtime LLM). */
export function createStaticTreemapAi(sidecar: TreemapSidecarContent | null | undefined) {
  if (!sidecar?.nodes || Object.keys(sidecar.nodes).length === 0) return undefined;

  const nodes = sidecar.nodes;
  const links = sidecar.links ?? [];
  const chapterFlow = sidecar.chapterFlow ?? [];

  return {
    async describeNodes(
      batch: { id: string }[],
      { signal }: { signal: AbortSignal },
    ): Promise<Record<string, { subtitle: string }>> {
      if (signal.aborted) return {};
      const out: Record<string, { subtitle: string }> = {};
      for (const node of batch) {
        const subtitle = nodes[node.id]?.subtitle?.trim();
        if (subtitle) out[node.id] = { subtitle };
      }
      return out;
    },
    async inferLinks(
      input: { allowedTypes?: string[] },
      { signal }: { signal: AbortSignal },
    ) {
      if (signal.aborted || links.length === 0) return [];
      const allowed = new Set(input.allowedTypes ?? []);
      return links
        .filter((l) => allowed.has(l.type))
        .map((l) => ({
          from: l.from,
          to: l.to,
          type: l.type,
          label: l.label,
          reason: l.reason,
        }));
    },
    async labelChapterFlow(
      chapters: { title: string }[],
      { signal }: { signal: AbortSignal },
    ) {
      if (signal.aborted || chapterFlow.length === 0) return [];
      const want = Math.max(0, chapters.length - 1);
      return chapterFlow.slice(0, want);
    },
    async summarizeDoc() {
      return "";
    },
  };
}
