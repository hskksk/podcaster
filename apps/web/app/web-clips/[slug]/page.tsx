import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "../../../components/SiteShell";
import { feedUrl, loadSiteConfig } from "../../../lib/site/config";
import { loadPublicWebClip, loadPublicWebClips } from "../../../lib/site/web-clips";
import { renderMarkdoc } from "../../../lib/site/render-markdoc";
import { textify } from "../../../../../scripts/lib/mdoc";

export const dynamic = "force-static";
export const revalidate = false;
export const dynamicParams = false;

type Params = { slug: string };

export async function generateStaticParams() {
  const clips = loadPublicWebClips();
  if (clips.length === 0) {
    throw new Error(
      `content/web-clips produced 0 clips at build (cwd=${process.cwd()}). ` +
        "The public site is statically generated like GitHub Pages; the monorepo content/ tree must be visible to `next build`.",
    );
  }
  return clips.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const clip = loadPublicWebClip(slug);
  if (!clip) return { title: "Not found" };
  const cfg = loadSiteConfig();
  const desc = textify(clip.source)
    .replace(/^#.*$/m, "")
    .replace(/[#*`[\]]/g, "")
    .trim()
    .slice(0, 120)
    .replace(/\n+/g, " ");
  return {
    title: clip.title,
    description: desc || cfg.siteDescription,
    // Access is gated by middleware (same GitHub OAuth login as Keystatic);
    // keep it out of search indexes too, in case the static HTML is ever
    // reachable.
    robots: { index: false, follow: false },
  };
}

export default async function WebClipPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const clip = loadPublicWebClip(slug);
  if (!clip) notFound();
  const cfg = loadSiteConfig();
  const clips = loadPublicWebClips();
  const body = renderMarkdoc(clip.source);
  const rss = feedUrl();

  return (
    <div className="public-site">
      <SiteShell siteTitle={cfg.siteTitle} feedUrl={rss} articleCount={clips.length}>
        <p className="back-link">
          <Link href="/web-clips">← Web Clips一覧</Link>
        </p>
        {clip.date ? <p className="article-meta">{clip.date}</p> : null}
        {clip.url ? (
          <p className="article-meta">
            <a href={clip.url} target="_blank" rel="noopener noreferrer">
              🔗 元記事
            </a>
          </p>
        ) : null}
        <article className="markdoc">{body}</article>
      </SiteShell>
    </div>
  );
}
