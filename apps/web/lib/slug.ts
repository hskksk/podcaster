/** Directory slug from a title. Keep Japanese; do not ASCII-fold. */
export function slugFromTitle(name: string): string {
  const slug = name
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug.length > 0 ? slug : "untitled";
}

export const titleSlugField = {
  name: { label: "Title" as const },
  slug: {
    label: "Slug",
    generate: slugFromTitle,
    description: "ディレクトリ名。日本語はそのまま残す（ASCII 化しない）。",
  },
};
