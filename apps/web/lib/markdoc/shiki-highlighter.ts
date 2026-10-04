"use client";

import { createShikiRenderer, type Highlighter as MarkdocHighlighter } from "@hskksk/markdoc-react";
import type { Highlighter } from "shiki";

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
  "text",
] as const;

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then(({ createHighlighter }) =>
      createHighlighter({
        themes: ["github-light", "github-dark"],
        langs: [...LANGS],
      }),
    );
  }
  return highlighterPromise;
}

export function createSiteShikiHighlighter(theme: "light" | "dark"): MarkdocHighlighter {
  const shikiTheme = theme === "dark" ? "github-dark" : "github-light";
  return createShikiRenderer(
    {
      codeToHtml: async (code, options) => {
        const h = await getHighlighter();
        const lang = (LANGS as readonly string[]).includes(options.lang) ? options.lang : "plaintext";
        return h.codeToHtml(code, { lang, theme: shikiTheme });
      },
    },
    { theme: shikiTheme },
  );
}
