import { marked, type MarkedExtension } from "marked";

const mathExtension: MarkedExtension = {
  extensions: [
    {
      name: "blockMath",
      level: "block",
      start(src) {
        return src.indexOf("$$");
      },
      tokenizer(src) {
        const match = src.match(/^\$\$([^$]*?)\$\$/s);
        if (match) return { type: "blockMath", raw: match[0], text: match[1].trim() };
      },
      renderer(token) {
        return `<div class="math-display">\\[${token.text}\\]</div>\n`;
      },
    },
    {
      name: "inlineMath",
      level: "inline",
      start(src) {
        return src.indexOf("$");
      },
      tokenizer(src) {
        const match = src.match(/^\$([^$\n]+?)\$/);
        if (match) return { type: "inlineMath", raw: match[0], text: match[1] };
      },
      renderer(token) {
        return `<span class="math-inline">\\(${token.text}\\)</span>`;
      },
    },
  ],
};

marked.use(mathExtension);

export async function markdownToHtml(md: string): Promise<string> {
  return marked.parse(md, { async: true });
}
