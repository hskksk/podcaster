import type { TreemapLinkType } from "../../../apps/web/lib/site/treemap-labels-types.ts";

export type LinkManifest = {
  orderedNodeIds: string[];
  chapters: Array<{ id: string; title: string }>;
  explicitLinks?: Array<{ from: string; to: string; type?: string }>;
};

const MAX_LINKS = 30;

const LINK_TYPES = new Set<string>([
  "flow",
  "seq",
  "cause",
  "evidence",
  "apply",
  "contrast",
  "rec",
  "end",
  "ref",
]);

export type SuggestedLink = {
  from: string;
  to: string;
  type: TreemapLinkType;
  label?: string;
  reason?: string;
};

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function dedupeKey(l: SuggestedLink): string {
  return `${l.from}|${l.to}|${l.type}`;
}

/** Mechanical backfill: chapter arrows + inter-chapter flow + light seq within chapters. */
export function suggestLinksFromManifest(manifest: LinkManifest): {
  links: SuggestedLink[];
  chapterFlow: string[];
} {
  const links: SuggestedLink[] = [];
  const seen = new Set<string>();

  const push = (link: SuggestedLink) => {
    const key = dedupeKey(link);
    if (seen.has(key)) return;
    seen.add(key);
    links.push(link);
  };

  for (const raw of manifest.explicitLinks ?? []) {
    const type = (raw.type ?? "ref").trim();
    if (!LINK_TYPES.has(type)) continue;
    push({ from: raw.from, to: raw.to, type: type as TreemapLinkType });
  }

  const chapters = manifest.chapters;
  for (let i = 0; i < chapters.length - 1; i++) {
    push({ from: chapters[i].id, to: chapters[i + 1].id, type: "flow" });
  }

  const chapterIndex = new Map(chapters.map((ch, i) => [ch.id, i]));
  const ordered = manifest.orderedNodeIds;
  const chapterStarts: number[] = [];
  for (let i = 0; i < ordered.length; i++) {
    if (chapterIndex.has(ordered[i])) chapterStarts.push(i);
  }

  for (let c = 0; c < chapterStarts.length; c++) {
    const start = chapterStarts[c];
    const end = c + 1 < chapterStarts.length ? chapterStarts[c + 1] : ordered.length;
    const slice = ordered.slice(start + 1, end);
    for (let j = 0; j < slice.length - 1 && links.length < MAX_LINKS; j++) {
      push({ from: slice[j], to: slice[j + 1], type: "seq" });
    }
  }

  const chapterFlow =
    chapters.length < 2
      ? []
      : chapters.slice(0, -1).map((ch, i) => clip(`→ ${chapters[i + 1].title}`, 48));

  return { links: links.slice(0, MAX_LINKS), chapterFlow };
}
