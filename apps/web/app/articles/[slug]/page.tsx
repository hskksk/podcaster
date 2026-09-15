import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "../../../components/SiteShell";
import { audioForDoc, fetchArticleAudioMap } from "../../../lib/site/audio";
import { feedUrl, loadSiteConfig } from "../../../lib/site/config";
import { loadPublicDoc, loadPublicDocs } from "../../../lib/site/docs";
import { markdownToHtml } from "../../../lib/site/markdown";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateStaticParams() {
  return loadPublicDocs().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = loadPublicDoc(slug);
  if (!doc) return { title: "Not found" };
  const cfg = loadSiteConfig();
  const desc = doc.markdown
    .replace(/^#.*$/m, "")
    .replace(/[#*`[\]]/g, "")
    .trim()
    .slice(0, 120)
    .replace(/\n+/g, " ");
  return {
    title: doc.title,
    description: desc || cfg.siteDescription,
  };
}

export default async function ArticlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const doc = loadPublicDoc(slug);
  if (!doc) notFound();
  const cfg = loadSiteConfig();
  const docs = loadPublicDocs();
  const audioMap = await fetchArticleAudioMap();
  const audioUrl = audioForDoc(audioMap, doc.filename);
  const html = await markdownToHtml(doc.markdown);
  const rss = feedUrl();

  return (
    <div className="public-site">
      <SiteShell siteTitle={cfg.siteTitle} feedUrl={rss} articleCount={docs.length}>
        <p className="back-link">
          <Link href="/">← 記事一覧</Link>
        </p>
        {doc.date ? <p className="article-meta">{doc.date}</p> : null}
        {audioUrl ? (
          <div className="podcast-player">
            <p>🎧 このエピソードを聴く</p>
            <audio controls preload="metadata" src={audioUrl} />
          </div>
        ) : null}
        <article dangerouslySetInnerHTML={{ __html: html }} />
      </SiteShell>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.addEventListener("DOMContentLoaded",function(){if(window.renderMathInElement){window.renderMathInElement(document.body,{delimiters:[{left:"\\\\[",right:"\\\\]",display:true},{left:"\\\\(",right:"\\\\)",display:false}]});}});`,
        }}
      />
    </div>
  );
}
