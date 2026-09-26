import type { Metadata } from "next";
import { ArticleSearch } from "../../components/ArticleSearch";
import { SiteShell } from "../../components/SiteShell";
import { feedUrl, loadSiteConfig } from "../../lib/site/config";
import { loadPublicWebClips } from "../../lib/site/web-clips";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function WebClipsPage() {
  const cfg = loadSiteConfig();
  const clips = loadPublicWebClips();
  const rss = feedUrl();
  const cards = clips.map((c) => ({
    slug: c.slug,
    title: c.title,
    date: c.date,
  }));

  return (
    <SiteShell
      siteTitle={cfg.siteTitle}
      feedUrl={rss}
      articleCount={clips.length}
      variant="clips"
    >
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Web Clips</h1>
      <p className="mt-2 text-sm text-muted-fg">{clips.length} 件 · 要ログイン</p>
      <div className="mt-8">
        <ArticleSearch
          articles={cards}
          basePath="/web-clips"
          searchPlaceholder="Web Clipsを検索…"
        />
      </div>
    </SiteShell>
  );
}
