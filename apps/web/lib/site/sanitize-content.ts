/** Strip markup/control chars from git-sourced strings before React render (CodeQL js/stored-xss). */
export function sanitizePublicText(text: string): string {
  return text
    .replace(/[\0-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[<>]/g, "")
    .trim();
}

const SAFE_SLUG = /^[\w.-]+$/;

/** Allow only URL path–safe slug segments; fall back to content directory name. */
export function sanitizePublicSlug(slug: string, fallbackDir: string): string {
  const candidate = slug.trim();
  if (candidate && SAFE_SLUG.test(candidate) && !candidate.includes("..")) {
    return candidate;
  }
  const fromDir = fallbackDir.trim().replace(/[^\w.-]/g, "_");
  if (fromDir && SAFE_SLUG.test(fromDir)) return fromDir;
  return "article";
}

export function articleHref(slug: string): string {
  return `/articles/${encodeURIComponent(slug)}`;
}

export function webClipHref(slug: string): string {
  return `/web-clips/${encodeURIComponent(slug)}`;
}
