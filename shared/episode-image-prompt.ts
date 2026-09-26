/** Appended to every image prompt (including custom DB templates) to steer away from cover-art tropes. */
export const EPISODE_IMAGE_STYLE_SUFFIX = `Visual requirements:
- One original editorial illustration (magazine essay / technical blog hero art), not album art, CD cover, podcast cover template, or promotional poster layout.
- Pick a single clear scene, metaphor, or object study from the themes above; avoid icon collages and keyword soup.
- Contemporary conceptual illustration: confident composition, soft atmospheric background, polished palette, subtle hand-drawn texture.
- Square canvas, illustration fills the frame edge-to-edge (no mockup frame, bezel, or drop shadow around the art).

Hard constraints: no readable text, letters, numbers, logos, watermarks, or UI chrome. Avoid stock-photo realism, centered emblem with radial glow, and generic neon cyberpunk HUD aesthetics. Avoid human faces unless essential to the metaphor.`;

export const DEFAULT_EPISODE_IMAGE_PROMPT = `Draw a single square bespoke illustration for a long-form technical article. It should look like art an editor commissioned for the article—not packaging or cover-art layout.

Article context:
Title: {{title}}
Summary: {{description}}

Themes to illustrate (choose one coherent concept; do not illustrate every keyword):
{{excerpt}}

${EPISODE_IMAGE_STYLE_SUFFIX}`;

export function buildEpisodeImagePrompt(opts: {
  title: string;
  description: string;
  articleExcerpt: string;
  template?: string;
}): string {
  const template = opts.template?.trim() || DEFAULT_EPISODE_IMAGE_PROMPT;
  const body = template
    .replaceAll("{{title}}", opts.title.trim())
    .replaceAll("{{description}}", opts.description.trim())
    .replaceAll("{{excerpt}}", opts.articleExcerpt.trim().slice(0, 1200))
    .trim();

  if (body.includes("not album art, CD cover, podcast cover template")) {
    return body;
  }
  return `${body}\n\n${EPISODE_IMAGE_STYLE_SUFFIX}`;
}

export function excerptFromArticle(content: string, maxChars = 1200): string {
  const stripped = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_\[\]`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, maxChars);
}
