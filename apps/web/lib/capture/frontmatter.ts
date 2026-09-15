export type PodcastFlag = "none" | "queued" | "published" | "skipped";
export type CaptureCollection = "web-clips" | "docs";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n(?:\r?\n)?/;

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
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
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

export function wrapMdoc(fields: Record<string, string | undefined>, body: string): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === "") continue;
    lines.push(`${key}: ${yamlString(value)}`);
  }
  lines.push("---", "");
  const trimmed = body.replace(/^\uFEFF/, "");
  return `${lines.join("\n")}${trimmed.endsWith("\n") || trimmed === "" ? trimmed : `${trimmed}\n`}`;
}

export function setFrontmatterField(src: string, key: string, value: string): string {
  const { attrs, body } = parseFrontmatter(src);
  attrs[key] = value;
  return wrapMdoc(attrs, body);
}

export function isPodcastFlag(value: string): value is PodcastFlag {
  return value === "none" || value === "queued" || value === "published" || value === "skipped";
}

export function isCollection(value: string): value is CaptureCollection {
  return value === "web-clips" || value === "docs";
}
