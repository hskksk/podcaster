import type { Metadata } from "next";
import { PagefindSearch } from "../../components/PagefindSearch";
import { SiteShell } from "../../components/SiteShell";
import { feedUrl, loadSiteConfig } from "../../lib/site/config";
import { loadPublicDocs } from "../../lib/site/docs";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
  title: "検索",
  robots: { index: true, follow: true },
};

export default async function SearchPage() {
  const cfg = loadSiteConfig();
  const docs = loadPublicDocs();
  const rss = feedUrl();

  return (
    <SiteShell siteTitle={cfg.siteTitle} feedUrl={rss} articleCount={docs.length} variant="public">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">検索</h1>
      <p className="mt-2 text-sm text-muted-fg">公開記事の全文検索（ビルド時インデックス）</p>
      <div className="mt-10">
        <PagefindSearch />
      </div>
    </SiteShell>
  );
}
