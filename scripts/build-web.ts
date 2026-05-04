import fs from "fs";
import path from "path";
import { marked, type MarkedExtension } from "marked";
import { parse as parseToml } from "smol-toml";

const ARTICLES_DIR = path.resolve("articles");
const OUT_DIR = path.resolve("dist/web");
const ARTICLES_OUT_DIR = path.join(OUT_DIR, "articles");
const WEB_DIR = path.resolve("web");

// ── Config ──────────────────────────────────────────────────────────────────

interface SiteConfig {
  siteTitle: string;
  siteDescription: string;
  feedUrl: string;
}

function loadConfig(): SiteConfig {
  const raw = fs.readFileSync(path.resolve("config.toml"), "utf8");
  const toml = parseToml(raw) as Record<string, Record<string, string>>;
  return {
    siteTitle: toml.podcast?.title ?? "Podcaster Articles",
    siteDescription: toml.podcast?.description ?? "",
    feedUrl: toml.podcast?.feed_url ?? "",
  };
}

// ── marked math extension ────────────────────────────────────────────────────

const mathExtension: MarkedExtension = {
  extensions: [
    {
      name: "blockMath",
      level: "block",
      start(src) { return src.indexOf("$$"); },
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
      start(src) { return src.indexOf("$"); },
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

// ── RSS feed parsing ─────────────────────────────────────────────────────────

function unescapeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Returns a map of episode title → audio URL, parsed from the RSS feed. */
async function fetchEpisodeMap(feedUrl: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!feedUrl) return map;
  try {
    const res = await fetch(feedUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.warn(`RSS fetch failed: HTTP ${res.status}`);
      return map;
    }
    const xml = await res.text();
    for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const title = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1];
      const audioUrl = item.match(/<enclosure[^>]+url="([^"]+)"/)?.[1];
      if (title && audioUrl) {
        map.set(unescapeXml(title).trim(), unescapeXml(audioUrl));
      }
    }
    console.log(`  fetched ${map.size} episodes from RSS feed`);
  } catch (err) {
    console.warn(`RSS unavailable, skipping podcast links: ${err}`);
  }
  return map;
}

// ── Article metadata ─────────────────────────────────────────────────────────

interface ArticleMeta {
  filename: string;
  slug: string;
  date: string;
  title: string;
  content: string;
}

function parseDateFromFilename(filename: string): string {
  const m = filename.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function parseSlugFromFilename(filename: string): string {
  return filename.replace(/^\d{8}(_\d{6})?_/, "").replace(/\.md$/, "");
}

function parseTitleFromContent(content: string, fallback: string): string {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function loadArticles(): ArticleMeta[] {
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse()
    .map((filename) => {
      const content = fs.readFileSync(path.join(ARTICLES_DIR, filename), "utf8");
      const slug = parseSlugFromFilename(filename);
      const date = parseDateFromFilename(filename);
      const title = parseTitleFromContent(content, slug);
      return { filename, slug, date, title, content };
    });
}

// ── Template rendering ───────────────────────────────────────────────────────

function loadTemplate(): string {
  return fs.readFileSync(path.join(WEB_DIR, "template.html"), "utf8");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface TemplateVars {
  PAGE_TITLE: string;
  ROOT_PATH: string;
  SITE_TITLE: string;
  RSS_FEED_TAG: string;
  RSS_HEADER_LINK: string;
  CONTENT: string;
}

function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key as keyof TemplateVars] ?? "");
}

// ── Page builders ─────────────────────────────────────────────────────────────

function buildIndexContent(
  articles: ArticleMeta[],
  episodeMap: Map<string, string>
): string {
  const items = articles
    .map(({ slug, date, title }) => {
      const audioUrl = episodeMap.get(title);
      const playBadge = audioUrl
        ? ` <a class="play-badge" href="${escapeHtml(audioUrl)}" title="ポッドキャストを聴く">🎧 聴く</a>`
        : "";
      return `    <li>
      <span class="date">${date}</span>
      <a class="article-link" href="articles/${encodeURIComponent(slug)}.html">${escapeHtml(title)}</a>${playBadge}
    </li>`;
    })
    .join("\n");

  return `<h1>Articles</h1>\n<ul class="article-list">\n${items}\n</ul>`;
}

async function buildArticleContent(
  article: ArticleMeta,
  episodeMap: Map<string, string>
): Promise<string> {
  const html = await marked(article.content);
  const metaLine = article.date
    ? `<p class="article-meta">${article.date}</p>`
    : "";

  const audioUrl = episodeMap.get(article.title);
  const playerHtml = audioUrl
    ? `<div class="podcast-player">
  <p>🎧 このエピソードを聴く</p>
  <audio controls preload="metadata" src="${escapeHtml(audioUrl)}"></audio>
</div>`
    : "";

  return `<p class="back-link"><a href="../index.html">← 記事一覧</a></p>
${metaLine}
${playerHtml}
${html}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function build() {
  const cfg = loadConfig();
  const template = loadTemplate();
  const articles = loadArticles();
  const episodeMap = await fetchEpisodeMap(cfg.feedUrl);

  fs.mkdirSync(ARTICLES_OUT_DIR, { recursive: true });
  console.log(`Building ${articles.length} articles...`);

  const rssHeaderLink = cfg.feedUrl
    ? `<a class="rss-link" href="${escapeHtml(cfg.feedUrl)}">📻 Podcast RSS</a>`
    : "";
  const rssFeedTag = cfg.feedUrl
    ? `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(cfg.siteTitle)}" href="${escapeHtml(cfg.feedUrl)}">`
    : "";

  // Index page
  const indexContent = buildIndexContent(articles, episodeMap);
  const indexHtml = renderTemplate(template, {
    PAGE_TITLE: cfg.siteTitle,
    ROOT_PATH: "",
    SITE_TITLE: cfg.siteTitle,
    RSS_FEED_TAG: rssFeedTag,
    RSS_HEADER_LINK: rssHeaderLink,
    CONTENT: indexContent,
  });
  fs.writeFileSync(path.join(OUT_DIR, "index.html"), indexHtml);
  console.log("  wrote dist/web/index.html");

  // Individual article pages
  for (const article of articles) {
    const content = await buildArticleContent(article, episodeMap);
    const slug = encodeURIComponent(article.slug);
    const html = renderTemplate(template, {
      PAGE_TITLE: `${article.title} | ${cfg.siteTitle}`,
      ROOT_PATH: "../",
      SITE_TITLE: cfg.siteTitle,
      RSS_FEED_TAG: "",
      RSS_HEADER_LINK: rssHeaderLink,
      CONTENT: content,
    });
    fs.writeFileSync(path.join(ARTICLES_OUT_DIR, `${slug}.html`), html);
    console.log(`  wrote dist/web/articles/${slug}.html`);
  }

  console.log("Done. Output: dist/web/");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
