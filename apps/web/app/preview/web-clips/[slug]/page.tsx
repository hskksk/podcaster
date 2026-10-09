import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArticleHeader } from "../../../../components/ArticleHeader";
import { ArticlePager } from "../../../../components/ArticlePager";
import { ArticleMinimapLayout } from "../../../../components/ArticleMinimapLayout";
import { ReadingProgress } from "../../../../components/ReadingProgress";
import { SiteShell } from "../../../../components/SiteShell";
import { adjacentWebClipsForRequest } from "../../../../lib/site/adjacent-web-clips";
import {
  loadPublicWebClipForRequest,
  loadPublicWebClipsForRequest,
} from "../../../../lib/site/content-for-request";
import { feedUrl, loadSiteConfig } from "../../../../lib/site/config";
import { getDraftPreviewContext } from "../../../../lib/site/draft-context";
import { articleOpenGraph } from "../../../../lib/site/open-graph";
import { MarkdocArticleBody } from "../../../../components/MarkdocArticleBody";
import { mdocBodyForRender } from "../../../../lib/site/strip-duplicate-title";
import { prepareMarkdoc } from "../../../../lib/markdoc";
import { textify } from "../../../../../../scripts/lib/mdoc";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const draft = await getDraftPreviewContext();
  if (!draft.enabled) return { title: "Preview" };

  const { slug } = await params;
  const clip = await loadPublicWebClipForRequest(slug);
  if (!clip) return { title: "Not found" };
  const cfg = loadSiteConfig();
  const desc = textify(clip.source)
    .replace(/^#.*$/m, "")
    .replace(/[#*`[\]]/g, "")
    .trim()
    .slice(0, 120)
    .replace(/\n+/g, " ");
  return {
    ...articleOpenGraph({
      cfg,
      title: clip.title,
      description: desc || cfg.siteDescription,
      date: clip.date,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function PreviewWebClipPage({ params }: { params: Promise<Params> }) {
  const draft = await getDraftPreviewContext();
  if (!draft.enabled) {
    const { slug } = await params;
    redirect(`/web-clips/${encodeURIComponent(slug)}`);
  }

  const { slug } = await params;
  const clip = await loadPublicWebClipForRequest(slug);
  if (!clip) notFound();
  const cfg = loadSiteConfig();
  const clips = await loadPublicWebClipsForRequest();
  const renderSource = mdocBodyForRender(clip.source, clip.title);
  const { content } = prepareMarkdoc(renderSource);
  const { prev, next } = await adjacentWebClipsForRequest(slug);
  const rss = feedUrl();

  return (
    <>
      <ReadingProgress />
      <SiteShell
        siteTitle={cfg.siteTitle}
        feedUrl={rss}
        articleCount={clips.length}
        variant="clips"
        width="wide"
      >
        <div className="mx-auto max-w-3xl">
          <p className="mb-8 text-sm">
            <Link href="/" className="font-medium text-muted-fg no-underline hover:text-fg">
              メインサイト
            </Link>
            <span className="text-muted-fg"> / </span>
            <Link href="/web-clips" className="font-medium text-muted-fg no-underline hover:text-fg">
              Web Clips
            </Link>
          </p>
          <ArticleHeader
            title={clip.title}
            date={clip.date}
            source={clip.url}
            mdocSource={clip.source}
          />
        </div>

        <ArticleMinimapLayout source={renderSource}>
          <div className="markdoc">
            <MarkdocArticleBody content={content} />
          </div>
        </ArticleMinimapLayout>

        <div className="mx-auto max-w-3xl">
          <ArticlePager prev={prev} next={next} basePath="/preview/web-clips" />
        </div>
      </SiteShell>
    </>
  );
}
