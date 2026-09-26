export const DEFAULT_EPISODE_IMAGE_PROMPT = `Create a single square podcast episode artwork image (no text, no logos, no watermarks).

Topic summary:
Title: {{title}}
Description: {{description}}

Article excerpt (for visual themes only):
{{excerpt}}

Style: modern editorial illustration, clear focal subject, soft gradient background, suitable as podcast cover and social preview. Avoid readable text and human faces unless essential.`;

export function buildEpisodeImagePrompt(opts: {
  title: string;
  description: string;
  articleExcerpt: string;
  template?: string;
}): string {
  const template = opts.template?.trim() || DEFAULT_EPISODE_IMAGE_PROMPT;
  return template
    .replaceAll("{{title}}", opts.title.trim())
    .replaceAll("{{description}}", opts.description.trim())
    .replaceAll("{{excerpt}}", opts.articleExcerpt.trim().slice(0, 1200));
}

export function excerptFromArticle(content: string, maxChars = 1200): string {
  const stripped = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_\[\]`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, maxChars);
}
