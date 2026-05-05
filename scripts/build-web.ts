import fs from "fs";
import path from "path";
import { marked, type MarkedExtension } from "marked";
import { parse as parseToml } from "smol-toml";
import { createClient } from "@supabase/supabase-js";

const ARTICLES_DIR = path.resolve("articles");
const OUT_DIR = path.resolve("dist/web");
const ARTICLES_OUT_DIR = path.join(OUT_DIR, "articles");
const WEB_DIR = path.resolve("web");

// ── Config ──────────────────────────────────────────────────────────────────

interface SiteConfig {
  siteTitle: string;
  siteDescription: string;
  siteUrl: string;
  coverImage: string;
}

function loadConfig(): SiteConfig {
  const raw = fs.readFileSync(path.resolve("config.toml"), "utf8");
  const toml = parseToml(raw) as Record<string, Record<string, string>>;
  return {
    siteTitle: toml.podcast?.title ?? "Podcaster Articles",
    siteDescription: toml.podcast?.description ?? "",
    siteUrl: toml.podcast?.site_url ?? "",
    coverImage: toml.podcast?.cover_image ?? "cover.png",
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
async function fetchArticleAudioMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!projectRef || !serviceKey) {
    console.warn("  Supabase credentials not set, skipping podcast audio links.");
    return map;
  }
  try {
    const supabaseUrl = `https://${projectRef}.supabase.co`;
    const storageBase = `${supabaseUrl}/storage/v1/object/public/podcast`;

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data, error } = await supabase
      .from("episodes")
      .select("articles(ingest_meta), audio_files(storage_path, status)")
      .in("status", ["audio_ready", "published"]);

    if (error) throw new Error(error.message);

    for (const ep of data ?? []) {
      const ingestMeta = (ep.articles as unknown as { ingest_meta: Record<string, string> | null } | null)
        ?.ingest_meta;
      const inboxFile = ingestMeta?.inbox_file;
      const audioFile = (ep.audio_files as Array<{ storage_path: string; status: string }> | null)
        ?.find((af) => af.status === "ready");
      if (inboxFile && audioFile) {
        map.set(inboxFile, `${storageBase}/${audioFile.storage_path}`);
      }
    }
    console.log(`  fetched ${map.size} episode audio URLs from Supabase`);
  } catch (err) {
    console.warn(`  Supabase unavailable: ${err}`);
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
  OGP_META: string;
  HERO_SECTION: string;
  FOOTER_CONTENT: string;
  CONTENT: string;
}

function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key as keyof TemplateVars] ?? "");
}

// ── OGP meta tags ─────────────────────────────────────────────────────────────

function buildOgpMeta(
  title: string,
  description: string,
  imageUrl: string,
  type = "website",
): string {
  const lines = [
    `  <meta property="og:type" content="${escapeHtml(type)}">`,
    `  <meta property="og:title" content="${escapeHtml(title)}">`,
    `  <meta property="og:description" content="${escapeHtml(description)}">`,
    `  <meta name="description" content="${escapeHtml(description)}">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <meta name="twitter:title" content="${escapeHtml(title)}">`,
    `  <meta name="twitter:description" content="${escapeHtml(description)}">`,
  ];
  if (imageUrl) {
    lines.push(`  <meta property="og:image" content="${escapeHtml(imageUrl)}">`);
    lines.push(`  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">`);
  }
  return lines.join("\n");
}

// ── Hero section ──────────────────────────────────────────────────────────────

function buildHeroSection(cfg: SiteConfig, rootPath: string, feedUrl: string): string {
  if (!cfg.siteDescription) return "";
  const coverSrc = `${rootPath}${escapeHtml(cfg.coverImage)}`;
  const subscribeLine = feedUrl
    ? `\n      <a class="hero-subscribe" href="${escapeHtml(feedUrl)}">📻 Podcastを購読する</a>`
    : "";
  return `<section class="hero">
  <img class="hero-cover" src="${coverSrc}" alt="${escapeHtml(cfg.siteTitle)} cover">
  <div class="hero-body">
    <p class="hero-title">${escapeHtml(cfg.siteTitle)}</p>
    <p class="hero-desc">${escapeHtml(cfg.siteDescription)}</p>${subscribeLine}
  </div>
</section>`;
}

// ── Featured section ──────────────────────────────────────────────────────────

function buildFeaturedSection(
  articles: ArticleMeta[],
  episodeMap: Map<string, string>,
): string {
  const withAudio = articles.filter((a) => episodeMap.has(a.filename));
  const candidates = withAudio.length >= 3
    ? withAudio.slice(0, 3)
    : [...withAudio, ...articles.filter((a) => !episodeMap.has(a.filename))].slice(0, 3);

  if (candidates.length === 0) return "";

  const cards = candidates
    .map(({ slug, date, title, filename }) => {
      const audioUrl = episodeMap.get(filename);
      const audioLine = audioUrl
        ? `\n      <a class="card-audio" href="${escapeHtml(audioUrl)}">🎧 このエピソードを聴く</a>`
        : "";
      return `    <div class="featured-card">
      <span class="card-date">${date}</span>
      <a class="card-title" href="articles/${encodeURIComponent(slug)}.html">${escapeHtml(title)}</a>${audioLine}
    </div>`;
    })
    .join("\n");

  return `<div class="featured-section">
  <p class="section-title">🆕 最新エピソード</p>
  <div class="featured-grid">
${cards}
  </div>
</div>`;
}

// ── Footer ────────────────────────────────────────────────────────────────────

function buildFooter(cfg: SiteConfig, articleCount: number, feedUrl: string): string {
  const year = new Date().getFullYear();
  const rssLink = feedUrl
    ? `<a href="${escapeHtml(feedUrl)}">📻 RSS</a>`
    : "";
  const countPart = `${articleCount} articles`;
  const copyright = `© ${year} ${escapeHtml(cfg.siteTitle)}`;
  const parts = [rssLink, countPart, copyright].filter(Boolean).join(" · ");
  return `<span>${parts}</span>`;
}

// ── Page builders ─────────────────────────────────────────────────────────────

function buildIndexContent(
  articles: ArticleMeta[],
  episodeMap: Map<string, string>,
): string {
  const featuredHtml = buildFeaturedSection(articles, episodeMap);

  const cards = articles
    .map(({ slug, date, title, filename }) => {
      const audioUrl = episodeMap.get(filename);
      const audioLine = audioUrl
        ? `\n      <a class="card-audio" href="${escapeHtml(audioUrl)}">🎧 聴く</a>`
        : "";
      return `  <div class="article-card">
    <span class="card-date">${date}</span>
    <a class="card-title" href="articles/${encodeURIComponent(slug)}.html">${escapeHtml(title)}</a>${audioLine}
  </div>`;
    })
    .join("\n");

  const searchScript = `<script>
(function() {
  var input = document.getElementById('article-search');
  var noResults = document.getElementById('no-results');
  input.addEventListener('input', function() {
    var q = input.value.toLowerCase();
    var cards = document.querySelectorAll('#article-grid .article-card');
    var found = 0;
    cards.forEach(function(c) {
      var title = c.querySelector('.card-title').textContent.toLowerCase();
      var match = title.indexOf(q) !== -1;
      c.style.display = match ? '' : 'none';
      if (match) found++;
    });
    noResults.style.display = found === 0 && q.length > 0 ? 'block' : 'none';
  });
})();
</script>`;

  return `${featuredHtml}<p class="section-title">すべての記事 (${articles.length}件)</p>
<div class="search-box">
  <input type="search" id="article-search" placeholder="🔍 記事を検索..." autocomplete="off">
</div>
<div id="article-grid" class="article-grid">
${cards}
</div>
<p class="no-results" id="no-results">該当する記事が見つかりませんでした。</p>
${searchScript}`;
}

async function buildArticleContent(
  article: ArticleMeta,
  episodeMap: Map<string, string>,
): Promise<string> {
  const html = await marked(article.content);
  const metaLine = article.date
    ? `<p class="article-meta">${article.date}</p>`
    : "";

  const audioUrl = episodeMap.get(article.filename);
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
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const feedUrl = projectRef
    ? `https://${projectRef}.supabase.co/storage/v1/object/public/podcast/feed.xml`
    : "";
  const episodeMap = await fetchArticleAudioMap();

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(ARTICLES_OUT_DIR, { recursive: true });
  console.log(`Building ${articles.length} articles...`);

  // Copy public/ assets to dist/web/
  const publicDir = path.resolve("public");
  if (fs.existsSync(publicDir)) {
    for (const f of fs.readdirSync(publicDir)) {
      fs.copyFileSync(path.join(publicDir, f), path.join(OUT_DIR, f));
    }
    console.log("  copied public/ assets");
  }

  const rssHeaderLink = feedUrl
    ? `<a class="rss-link" href="${escapeHtml(feedUrl)}">📻 Podcast RSS</a>`
    : "";
  const rssFeedTag = feedUrl
    ? `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(cfg.siteTitle)}" href="${escapeHtml(feedUrl)}">`
    : "";

  const coverImageUrl = cfg.siteUrl && cfg.coverImage
    ? `${cfg.siteUrl}/${cfg.coverImage}`
    : "";

  const footerContent = buildFooter(cfg, articles.length, feedUrl);

  // Index page
  const indexOgpMeta = buildOgpMeta(cfg.siteTitle, cfg.siteDescription, coverImageUrl);
  const heroSection = buildHeroSection(cfg, "", feedUrl);
  const indexContent = buildIndexContent(articles, episodeMap);
  const indexHtml = renderTemplate(template, {
    PAGE_TITLE: cfg.siteTitle,
    ROOT_PATH: "",
    SITE_TITLE: cfg.siteTitle,
    RSS_FEED_TAG: rssFeedTag,
    RSS_HEADER_LINK: rssHeaderLink,
    OGP_META: indexOgpMeta,
    HERO_SECTION: heroSection,
    FOOTER_CONTENT: footerContent,
    CONTENT: indexContent,
  });
  fs.writeFileSync(path.join(OUT_DIR, "index.html"), indexHtml);
  console.log("  wrote dist/web/index.html");

  // Individual article pages
  for (const article of articles) {
    const content = await buildArticleContent(article, episodeMap);
    const articleDesc = article.content
      .replace(/^#.*$/m, "")
      .replace(/[#*`\[\]]/g, "")
      .trim()
      .slice(0, 120)
      .replace(/\n+/g, " ");
    const articleOgpMeta = buildOgpMeta(
      `${article.title} | ${cfg.siteTitle}`,
      articleDesc || cfg.siteDescription,
      coverImageUrl,
      "article",
    );
    const html = renderTemplate(template, {
      PAGE_TITLE: `${article.title} | ${cfg.siteTitle}`,
      ROOT_PATH: "../",
      SITE_TITLE: cfg.siteTitle,
      RSS_FEED_TAG: "",
      RSS_HEADER_LINK: rssHeaderLink,
      OGP_META: articleOgpMeta,
      HERO_SECTION: "",
      FOOTER_CONTENT: footerContent,
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
