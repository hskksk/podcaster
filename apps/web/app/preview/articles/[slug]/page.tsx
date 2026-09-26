import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArticleHeader } from "../../../../components/ArticleHeader";
import { ArticlePager } from "../../../../components/ArticlePager";
import { ArticleToc } from "../../../../components/ArticleToc";
import { EpisodePlayer } from "../../../../components/EpisodePlayer";
import { ReadingProgress } from "../../../../components/ReadingProgress";
import { SiteShell } from "../../../../components/SiteShell";
import { adjacentPublicDocsForRequest } from "../../../../lib/site/adjacent-docs";
import { audioForPublicDoc, fetchArticleAudioMap } from "../../../../lib/site/audio";
import {
  loadPublicDocForRequest,
  loadPublicDocsForRequest,
} from "../../../../lib/site/content-for-request";
import { feedUrl, loadSiteConfig } from "../../../../lib/site/config";
import { getDraftPreviewContext } from "../../../../lib/site/draft-context";
import { fetchArticleImageMap, imageForPublicDoc } from "../../../../lib/site/episode-images";
import { articleOpenGraph } from "../../../../lib/site/open-graph";
import { renderMarkdoc } from "../../../../lib/site/render-markdoc";
import { mdocBodyForRender } from "../../../../lib/site/strip-duplicate-title";
import { extractToc } from "../../../../lib/site/toc";
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
  const doc = await loadPublicDocForRequest(slug);
  if (!doc) return { title: "Not found" };
  const cfg = loadSiteConfig();
  const imageMap = await fetchArticleImageMap();
  const episodeImage = imageForPublicDoc(imageMap, doc);
  const desc = textify(doc.source)
    .replace(/^#.*$/m, "")
    .replace(/[#*`[\]]/g, "")
    .trim()
    .slice(0, 120)
    .replace(/\n+/g, " ");
  return {
    ...articleOpenGraph({
      cfg,
      title: doc.title,
      description: desc || cfg.siteDescription,
      date: doc.date,
      imageUrl: episodeImage,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function PreviewArticlePage({ params }: { params: Promise<Params> }) {
  const draft = await getDraftPreviewContext();
  if (!draft.enabled) {
    const { slug } = await params;
    redirect(`/articles/${encodeURIComponent(slug)}`);
  }

  const { slug } = await params;
  const doc = await loadPublicDocForRequest(slug);
  if (!doc) notFound();
  const cfg = loadSiteConfig();
  const docs = await loadPublicDocsForRequest();
  const audioMap = await fetchArticleAudioMap();
  const audioUrl = audioForPublicDoc(audioMap, doc);
  const renderSource = mdocBodyForRender(doc.source, doc.title);
  const body = renderMarkdoc(renderSource);
  const toc = extractToc(renderSource);
  const { prev, next } = await adjacentPublicDocsForRequest(slug);
  const rss = feedUrl();

  return (
    <>
      <ReadingProgress />
      <SiteShell
        siteTitle={cfg.siteTitle}
        feedUrl={rss}
        articleCount={docs.length}
        variant="public"
        width="wide"
      >
        <div className="mx-auto max-w-3xl">
          <p className="mb-8 text-sm">
            <Link href="/" className="font-medium text-muted-fg no-underline hover:text-fg">
              ← 記事一覧
            </Link>
          </p>
          <ArticleHeader
            title={doc.title}
            date={doc.date}
            source={doc.sourceUrl}
            mdocSource={doc.source}
          />
          {audioUrl ? <EpisodePlayer src={audioUrl} className="mb-10" /> : null}
        </div>

        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
          <article className="markdoc mx-auto min-w-0 max-w-3xl lg:mx-0">{body}</article>
          <aside className="mx-auto w-full max-w-3xl lg:mx-0">
            <ArticleToc entries={toc} />
          </aside>
        </div>

        <div className="mx-auto max-w-3xl">
          <ArticlePager prev={prev} next={next} basePath="/preview/articles" />
        </div>
      </SiteShell>
    </>
  );
}
