import fs from "fs";
import path from "path";
import { marked, type MarkedExtension } from "marked";
import { parse as parseToml } from "smol-toml";
import { createClient } from "@supabase/supabase-js";
import { detectProjectRef, detectServiceKey } from "./lib/supabase-detect.ts";

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

// ── Supabase: article title → audio URL mapping ──────────────────────────────

/**
 * Queries Supabase for published episodes and returns a map of
 * article title (= markdown H1) → public audio URL.
 * Falls back to an empty map if credentials are unavailable.
 */
async function fetchArticleAudioMap(cfg: SiteConfig): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const projectRef = detectProjectRef();
    const serviceKey = detectServiceKey(projectRef);
    const supabaseUrl = `https://${projectRef}.supabase.co`;
    const storageBase = `${supabaseUrl}/storage/v1/object/public/podcast`;

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data, error } = await supabase
      .from("episodes")
      .select("articles(title), audio_files(storage_path, status)")
      .in("status", ["audio_ready", "published"]);

    if (error) throw new Error(error.message);

    for (const ep of data ?? []) {
      const articleTitle = (ep.articles as { title: string } | null)?.title;
      const audioFile = (ep.audio_files as Array<{ storage_path: string; status: string }> | null)
        ?.find((af) => af.status === "ready");
      if (articleTitle && audioFile) {
        map.set(articleTitle.trim(), `${storageBase}/${audioFile.storage_path}`);
      }
    }
    console.log(`  fetched ${map.size} episode audio URLs from Supabase`);
  } catch (err) {
    console.warn(`Supabase unavailable, skipping podcast audio links: ${err}`);
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
  const episodeMap = await fetchArticleAudioMap(cfg);

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
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
    const html = renderTemplate(template, {
      PAGE_TITLE: `${article.title} | ${cfg.siteTitle}`,
      ROOT_PATH: "../",
      SITE_TITLE: cfg.siteTitle,
      RSS_FEED_TAG: "",
      RSS_HEADER_LINK: rssHeaderLink,
      CONTENT: content,
    });
    // Save with the raw Unicode filename; encodeURIComponent is used only in href links
    fs.writeFileSync(path.join(ARTICLES_OUT_DIR, `${article.slug}.html`), html);
    console.log(`  wrote dist/web/articles/${article.slug}.html`);
  }

  console.log("Done. Output: dist/web/");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
