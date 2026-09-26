import "server-only";

import { createHighlighter, type Highlighter } from "shiki";

let highlighter: Highlighter | null = null;

const LANGS = [
  "bash",
  "css",
  "go",
  "html",
  "javascript",
  "json",
  "jsx",
  "markdown",
  "python",
  "rust",
  "sql",
  "toml",
  "tsx",
  "typescript",
  "yaml",
  "dockerfile",
  "plaintext",
] as const;

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [...LANGS],
    });
  }
  return highlighter;
}

export async function highlightCode(code: string, lang: string): Promise<string> {
  const h = await getHighlighter();
  const language = (LANGS as readonly string[]).includes(lang) ? lang : "plaintext";
  return h.codeToHtml(code.trimEnd(), {
    lang: language,
    themes: { light: "github-light", dark: "github-dark" },
  });
}
