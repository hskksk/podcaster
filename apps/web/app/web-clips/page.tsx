import { ArticleSearch } from "../../components/ArticleSearch";
import { SiteShell } from "../../components/SiteShell";
import { feedUrl, loadSiteConfig } from "../../lib/site/config";
import { loadPublicWebClips } from "../../lib/site/web-clips";

export const dynamic = "force-static";
export const revalidate = false;

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
    <div className="public-site">
      <SiteShell siteTitle={cfg.siteTitle} feedUrl={rss} articleCount={clips.length}>
        <p className="section-title">Web Clips ({clips.length}件)</p>
        <ArticleSearch
          articles={cards}
          basePath="/web-clips"
          searchPlaceholder="🔍 Web Clipsを検索..."
        />
      </SiteShell>
    </div>
  );
}
