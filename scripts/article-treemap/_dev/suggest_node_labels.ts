export type LabelNode = {
  id: string;
  path: string;
  title: string;
  excerpt: string;
  needsLabel: boolean;
};

export function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function leafPath(path: string): string {
  const parts = path.split(" > ");
  return parts[parts.length - 1] ?? path;
}

function parentPath(path: string): string | undefined {
  const parts = path.split(" > ");
  if (parts.length < 2) return undefined;
  return parts[parts.length - 2];
}

function looksLikeOpeningSnippet(title: string, excerpt: string): boolean {
  const t = title.replace(/\s+/g, "").replace(/…$/g, "");
  const e = excerpt.replace(/\s+/g, "");
  if (!t || t.length < 8) return false;
  return e.startsWith(t) || title.endsWith("…");
}

function titleCandidates(node: LabelNode): string[] {
  const excerpt = node.excerpt.replace(/\s+/g, " ").trim();
  const sents = sentences(excerpt);
  const out: string[] = [];

  if (/^\[\d+\]/.test(excerpt)) {
    const cite = excerpt.match(/^\[(\d+)\]\s*([^.”]+)/);
    if (cite) out.push(clip(`[${cite[1]}] ${cite[2]}`, 24));
  }

  if (excerpt.startsWith("[表]")) {
    out.push(clip("表：" + excerpt.replace(/^\[表\]\s*/, "").slice(0, 40), 24));
  } else if (excerpt.startsWith("[コード")) {
    const lang = excerpt.match(/\[コード:([^\]]+)\]/)?.[1];
    out.push(clip(lang ? `図（${lang}）` : "図・コード", 24));
  }

  const colon = excerpt.match(/^(.{1,50}?)(?:：| — | – |: )(.+)$/);
  if (colon) {
    out.push(clip(colon[2], 24));
    out.push(clip(colon[1], 24));
  }

  if (sents[0]) out.push(clip(sents[0], 24));
  if (sents[1]) out.push(clip(sents[1], 24));

  const leaf = leafPath(node.path);
  if (leaf.length <= 24 && !leaf.endsWith("…") && !looksLikeOpeningSnippet(node.title, excerpt)) {
    out.push(leaf);
  }

  if (!looksLikeOpeningSnippet(node.title, excerpt) && node.title.trim()) {
    out.push(clip(node.title, 24));
  }

  return out;
}

function subtitleFromExcerpt(excerpt: string, title: string, maxLen: number): string {
  const flat = excerpt.replace(/\s+/g, " ").trim();
  const sents = sentences(flat);
  let body = sents.length >= 2 ? sents.join("") : flat;
  const titleCore = title.replace(/…$/g, "").trim();
  if (titleCore.length >= 8 && body.startsWith(titleCore)) {
    body = sents.slice(1).join("") || flat;
  }
  if (body.length < 24 && sents[0]) body = flat;
  let sub = clip(body, maxLen);
  const norm = (s: string) => s.replace(/\s+/g, "").replace(/…$/g, "");
  if (norm(sub) === norm(title) || sub.length < 32) {
    sub = clip(flat, maxLen);
  }
  return sub;
}

/** One short unique line per tile; subtitle is longer (shown in treemap small). */
export function suggestNodeLabels(
  nodes: LabelNode[],
  opts?: { subtitleMax?: number },
): Record<string, { title: string; subtitle: string }> {
  const subtitleMax = opts?.subtitleMax ?? 110;
  const usedTitlesByParent = new Map<string, Set<string>>();
  const globalTitles = new Set<string>();
  const out: Record<string, { title: string; subtitle: string }> = {};

  for (const node of nodes) {
    if (!node.needsLabel) continue;

    const parent = parentPath(node.path) ?? "";
    const used = usedTitlesByParent.get(parent) ?? new Set<string>();
    usedTitlesByParent.set(parent, used);

    let title = "";
    for (const candidate of titleCandidates(node)) {
      const c = candidate.trim();
      if (!c || used.has(c) || globalTitles.has(c)) continue;
      title = c;
      break;
    }
    if (!title) {
      for (const candidate of titleCandidates(node)) {
        const c = candidate.trim();
        if (c) {
          title = c;
          break;
        }
      }
    }
    if (!title) title = clip(node.excerpt, 22);

    let n = 2;
    let unique = title;
    while (used.has(unique) || globalTitles.has(unique)) {
      unique = clip(`${title}（${n}）`, 24);
      n++;
    }
    title = unique;
    used.add(title);
    globalTitles.add(title);

    const subtitle = subtitleFromExcerpt(node.excerpt, title, subtitleMax);
    out[node.id] = { title, subtitle };
  }

  return out;
}
