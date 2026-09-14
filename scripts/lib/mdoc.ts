/**
 * Mechanical Markdown ↔ Markdoc conversion for Phase 1b.
 *
 * Convert (md → mdoc body): fence-outside `$`/`$$` and mermaid fences only.
 * Textify (mdoc → md): strip YAML frontmatter, restore known tags.
 * Code fences and inline code are never rewritten.
 *
 * Roundtrip: textify(frontmatter + markdownToMdoc(md)) === md
 */

export type PodcastFlag = "none" | "queued" | "published" | "skipped";

export type DocsFrontmatter = {
  title: string;
  publishedAt?: string;
  sourceUrl?: string;
  podcast: PodcastFlag;
  legacyFilename: string;
};

export type WebClipFrontmatter = {
  title: string;
  url?: string;
  clippedAt?: string;
  podcast: PodcastFlag;
  legacyFilename: string;
  promotedTo?: string;
};

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n(?:\r?\n)?/;

export function parseTitleFromContent(content: string, fallback: string): string {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

export function parseFrontmatter(src: string): { attrs: Record<string, string>; body: string } {
  const m = src.match(FRONTMATTER_RE);
  if (!m) return { attrs: {}, body: src };
  const attrs: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    attrs[kv[1]] = unquoteYaml(kv[2].trim());
  }
  return { attrs, body: src.slice(m[0].length) };
}

function unquoteYaml(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    try {
      return JSON.parse(value.startsWith("'") ? `"${value.slice(1, -1).replace(/"/g, '\\"')}"` : value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

function yamlString(value: string): string {
  if (value === "") return '""';
  if (/^[A-Za-z0-9_./+-]+$/.test(value) && !/^(true|false|null|yes|no)$/i.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

export function renderFrontmatter(fields: Record<string, string | undefined>): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === "") continue;
    lines.push(`${key}: ${yamlString(value)}`);
  }
  lines.push("---", "");
  return `${lines.join("\n")}`;
}

export function wrapMdoc(fields: Record<string, string | undefined>, body: string): string {
  return `${renderFrontmatter(fields)}${body}`;
}

type Segment =
  | { kind: "text"; value: string }
  | { kind: "inlineCode"; value: string }
  | { kind: "fence"; raw: string; lang: string; inner: string };

function isLineStart(src: string, i: number): boolean {
  return i === 0 || src[i - 1] === "\n";
}

function readFence(src: string, i: number): { raw: string; lang: string; inner: string; end: number } | null {
  if (!isLineStart(src, i)) return null;
  const ch = src[i];
  if (ch !== "`" && ch !== "~") return null;
  let n = 0;
  while (src[i + n] === ch) n++;
  if (n < 3) return null;
  const nl = src.indexOf("\n", i);
  if (nl === -1) return null;
  const info = src.slice(i + n, nl).trim();
  const lang = info.split(/\s+/)[0] ?? "";
  const rest = src.slice(nl);
  // Closing fence line without consuming the newline *after* it, so that
  // newline stays in the following text segment (needed for mermaid roundtrip).
  const closeRe = new RegExp(`\\n${ch.repeat(n)}+[^\\S\\n]*`);
  const close = rest.match(closeRe);
  if (!close || close.index === undefined) return null;
  const inner = rest.slice(1, close.index);
  const end = nl + close.index + close[0].length;
  const raw = src.slice(i, end);
  return { raw, lang, inner, end };
}

function readInlineCode(src: string, i: number): { value: string; end: number } | null {
  if (src[i] !== "`") return null;
  if (isLineStart(src, i) && src.startsWith("```", i)) return null;
  let n = 0;
  while (src[i + n] === "`") n++;
  if (n === 0) return null;
  const closer = "`".repeat(n);
  let j = i + n;
  while (j < src.length) {
    if (src.startsWith(closer, j) && src[j + n] !== "`") {
      return { value: src.slice(i, j + n), end: j + n };
    }
    j++;
  }
  return null;
}

function splitSegments(src: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  let textStart = 0;
  const flushText = (end: number) => {
    if (end > textStart) segments.push({ kind: "text", value: src.slice(textStart, end) });
  };
  while (i < src.length) {
    const fence = readFence(src, i);
    if (fence) {
      flushText(i);
      segments.push({ kind: "fence", raw: fence.raw, lang: fence.lang, inner: fence.inner });
      i = fence.end;
      textStart = i;
      continue;
    }
    const code = readInlineCode(src, i);
    if (code) {
      flushText(i);
      segments.push({ kind: "inlineCode", value: code.value });
      i = code.end;
      textStart = i;
      continue;
    }
    i++;
  }
  flushText(src.length);
  return segments;
}

/**
 * Convert fence-outside display math (`$$`) and mermaid. Leaves code untouched.
 *
 * Inline `$...$` is left as-is: Keystatic's `math` component is a block
 * `wrapper()`, so `{% math display=false %}` inside a paragraph fails
 * ("tag has unexpected children"). Pages still renders `$` via marked.
 *
 * Display math is wrapped with newlines so the tag body is a block
 * (required by the same wrapper). textify strips exactly one leading and
 * trailing newline to restore the original `$$` inner bytes.
 */
export function markdownToMdoc(md: string): string {
  return splitSegments(md)
    .map((seg) => {
      if (seg.kind === "inlineCode") return seg.value;
      if (seg.kind === "fence") {
        if (seg.lang === "mermaid") {
          return `{% diagram type="mermaid" %}\n${seg.inner}\n{% /diagram %}`;
        }
        return seg.raw;
      }
      return convertMathInText(seg.value);
    })
    .join("");
}

function convertMathInText(text: string): string {
  let i = 0;
  let out = "";
  while (i < text.length) {
    if (text.startsWith("$$", i)) {
      const end = text.indexOf("$$", i + 2);
      if (end !== -1) {
        const lineStart = text.lastIndexOf("\n", i - 1) + 1;
        const lineBefore = text.slice(lineStart, i);
        const afterSameLine = text.slice(end + 2).split("\n")[0] ?? "";
        // Block wrapper cannot live inside a blockquote (`> $$`) or share a
        // line with trailing prose (`$$...$$（注）`). Leave those as dollars.
        if (/^\s*>/.test(lineBefore) || afterSameLine.length > 0) {
          out += text.slice(i, end + 2);
          i = end + 2;
          continue;
        }
        const inner = text.slice(i + 2, end);
        out += `{% math display=true %}\n${inner}\n{% /math %}`;
        i = end + 2;
        continue;
      }
    }
    out += text[i];
    i++;
  }
  return out;
}

const MATH_OPEN_RE = /^\{%\s*math\s+display=(true|false)\s*%\}/;
const MATH_CLOSE = "{% /math %}";
const DIAGRAM_OPEN_RE = /^\{%\s*diagram\s+type="mermaid"\s*%\}/;
const DIAGRAM_CLOSE = "{% /diagram %}";

/**
 * Strip YAML frontmatter and restore known tags to CommonMark.
 * Unknown `{% %}` sequences (including those in code) are left as-is.
 */
export function textify(mdoc: string): string {
  const { body } = parseFrontmatter(mdoc);
  return textifyBody(body);
}

export function textifyBody(body: string): string {
  return splitSegments(body)
    .map((seg) => {
      if (seg.kind === "inlineCode" || seg.kind === "fence") return seg.kind === "fence" ? seg.raw : seg.value;
      return restoreTagsInText(seg.value);
    })
    .join("");
}

function restoreTagsInText(text: string): string {
  let i = 0;
  let out = "";
  while (i < text.length) {
    if (text[i] === "{") {
      const slice = text.slice(i);
      const mathOpen = slice.match(MATH_OPEN_RE);
      if (mathOpen) {
        const innerStart = i + mathOpen[0].length;
        const closeAt = text.indexOf(MATH_CLOSE, innerStart);
        if (closeAt !== -1) {
          let inner = text.slice(innerStart, closeAt);
          if (mathOpen[1] === "true") {
            if (inner.startsWith("\n")) inner = inner.slice(1);
            if (inner.endsWith("\n")) inner = inner.slice(0, -1);
            out += `$$${inner}$$`;
          } else {
            out += `$${inner}$`;
          }
          i = closeAt + MATH_CLOSE.length;
          continue;
        }
      }
      const diagramOpen = slice.match(DIAGRAM_OPEN_RE);
      if (diagramOpen) {
        const innerStart = i + diagramOpen[0].length;
        const closeAt = text.indexOf(DIAGRAM_CLOSE, innerStart);
        if (closeAt !== -1) {
          let inner = text.slice(innerStart, closeAt);
          if (inner.startsWith("\n")) inner = inner.slice(1);
          if (inner.endsWith("\n")) inner = inner.slice(0, -1);
          out += "```mermaid\n" + inner + "\n```";
          i = closeAt + DIAGRAM_CLOSE.length;
          continue;
        }
      }
    }
    out += text[i];
    i++;
  }
  return out;
}

export type RoundtripFailure = {
  path: string;
  message: string;
  originalLen: number;
  textifyLen: number;
  firstDiff: number;
};

export function roundtripCheck(md: string, mdoc: string, path: string): RoundtripFailure | null {
  const restored = textify(mdoc);
  if (restored === md) return null;
  let firstDiff = 0;
  const n = Math.min(restored.length, md.length);
  while (firstDiff < n && restored[firstDiff] === md[firstDiff]) firstDiff++;
  return {
    path,
    message: restored === md ? "" : "textify(mdoc) !== original markdown",
    originalLen: md.length,
    textifyLen: restored.length,
    firstDiff,
  };
}
