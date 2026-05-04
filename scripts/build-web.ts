import fs from "fs";
import path from "path";
import { marked, type MarkedExtension } from "marked";

const ARTICLES_DIR = path.resolve("articles");
const OUT_DIR = path.resolve("dist/web");
const ARTICLES_OUT_DIR = path.join(OUT_DIR, "articles");

// Protect math blocks from marked's tokenizer, then hand off to KaTeX auto-render
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
        if (match) {
          return { type: "blockMath", raw: match[0], text: match[1].trim() };
        }
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
        if (match) {
          return { type: "inlineMath", raw: match[0], text: match[1] };
        }
      },
      renderer(token) {
        return `<span class="math-inline">\\(${token.text}\\)</span>`;
      },
    },
  ],
};

marked.use(mathExtension);

interface ArticleMeta {
  filename: string;
  slug: string;
  date: string;
  title: string;
  content: string;
}

function parseDateFromFilename(filename: string): string {
  const m = filename.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseSlugFromFilename(filename: string): string {
  // Remove date prefix: YYYYMMDD[_HHMMSS]_
  return filename
    .replace(/^\d{8}(_\d{6})?_/, "")
    .replace(/\.md$/, "");
}

function parseTitleFromContent(content: string, fallback: string): string {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function loadArticles(): ArticleMeta[] {
  const files = fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();

  return files.map((filename) => {
    const content = fs.readFileSync(path.join(ARTICLES_DIR, filename), "utf8");
    const slug = parseSlugFromFilename(filename);
    const date = parseDateFromFilename(filename);
    const title = parseTitleFromContent(content, slug);
    return { filename, slug, date, title, content };
  });
}

const CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: "Noto Sans JP", sans-serif;
    font-size: 16px;
    line-height: 1.8;
    color: #1a1a1a;
    background: #fafafa;
    margin: 0;
    padding: 0 16px;
  }
  .site-header {
    max-width: 800px;
    margin: 0 auto;
    padding: 24px 0 16px;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }
  .site-header a { text-decoration: none; }
  .site-title { font-size: 1.2rem; font-weight: 700; color: #1a1a1a; }
  .rss-link { font-size: 0.85rem; color: #e07b00; }
  main { max-width: 800px; margin: 0 auto; padding: 32px 0 64px; }
  h1 { font-size: 1.6rem; line-height: 1.4; margin-bottom: 8px; }
  h2 { font-size: 1.3rem; margin-top: 2em; }
  h3 { font-size: 1.1rem; margin-top: 1.6em; }
  a { color: #1a5fa8; }
  code {
    font-family: "Menlo", "Consolas", monospace;
    font-size: 0.87em;
    background: #f0f0f0;
    padding: 2px 5px;
    border-radius: 3px;
  }
  pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #d0d0d0; padding: 8px 12px; text-align: left; }
  th { background: #f0f0f0; font-weight: 600; }
  blockquote { border-left: 4px solid #d0d0d0; margin: 0; padding-left: 16px; color: #555; }
  .math-display { overflow-x: auto; margin: 1.2em 0; }
  .article-meta { color: #666; font-size: 0.9rem; margin-bottom: 32px; }
  .back-link { margin-bottom: 24px; font-size: 0.9rem; }
  .article-list { list-style: none; padding: 0; margin: 0; }
  .article-list li { padding: 12px 0; border-bottom: 1px solid #eee; display: flex; align-items: baseline; gap: 16px; }
  .article-list .date { color: #666; font-size: 0.85rem; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .article-list a { font-size: 1rem; text-decoration: none; }
  .article-list a:hover { text-decoration: underline; }
  @media (max-width: 600px) {
    .article-list li { flex-direction: column; gap: 2px; }
  }
`;

const KATEX_HEAD = `
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
    onload="renderMathInElement(document.body, {
      delimiters: [
        {left: '\\\\[', right: '\\\\]', display: true},
        {left: '\\\\(', right: '\\\\)', display: false}
      ]
    });"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap" rel="stylesheet">
`;

function htmlShell(title: string, bodyContent: string, rssUrl = ""): string {
  const rssLink = rssUrl
    ? `<link rel="alternate" type="application/rss+xml" title="Podcast RSS" href="${rssUrl}">`
    : "";
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${rssLink}
  ${KATEX_HEAD}
  <style>${CSS}</style>
</head>
<body>
  <header class="site-header">
    <a href="../index.html" class="site-title">📻 Podcaster Articles</a>
    ${rssUrl ? `<a class="rss-link" href="${rssUrl}">RSS Podcast Feed</a>` : ""}
  </header>
  <main>
    ${bodyContent}
  </main>
</body>
</html>`;
}

function buildIndex(articles: ArticleMeta[]): string {
  const items = articles
    .map(
      ({ slug, date, title }) => `
    <li>
      <span class="date">${date}</span>
      <a href="articles/${encodeURIComponent(slug)}.html">${escapeHtml(title)}</a>
    </li>`
    )
    .join("");

  const body = `
    <h1>Articles</h1>
    <ul class="article-list">${items}</ul>
  `;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Podcaster Articles</title>
  ${KATEX_HEAD}
  <style>${CSS.replace(/\.site-header a \{ text-decoration/, ".site-header a.back { text-decoration")}</style>
</head>
<body>
  <header class="site-header">
    <span class="site-title">📻 Podcaster Articles</span>
  </header>
  <main>
    ${body}
  </main>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function buildArticlePage(article: ArticleMeta): Promise<string> {
  const html = await marked(article.content);
  const metaLine = article.date
    ? `<p class="article-meta">${article.date}</p>`
    : "";
  const body = `
    <p class="back-link"><a href="../index.html">← 記事一覧</a></p>
    ${metaLine}
    ${html}
  `;
  return htmlShell(article.title, body);
}

async function build() {
  fs.mkdirSync(ARTICLES_OUT_DIR, { recursive: true });

  const articles = loadArticles();
  console.log(`Building ${articles.length} articles...`);

  // Index page
  fs.writeFileSync(path.join(OUT_DIR, "index.html"), buildIndex(articles));
  console.log("  wrote dist/web/index.html");

  // Individual article pages
  for (const article of articles) {
    const html = await buildArticlePage(article);
    const outFile = path.join(
      ARTICLES_OUT_DIR,
      `${encodeURIComponent(article.slug)}.html`
    );
    fs.writeFileSync(outFile, html);
    console.log(`  wrote dist/web/articles/${encodeURIComponent(article.slug)}.html`);
  }

  console.log(`Done. Output: dist/web/`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
