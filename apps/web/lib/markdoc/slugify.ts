/**
 * Heading slug rules aligned with @hskksk/markdoc-react (`site-config` transform).
 * When the package adds a server export, import from there instead of duplicating.
 */
export function markdocSlugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
