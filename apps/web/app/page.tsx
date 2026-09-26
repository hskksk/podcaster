import Link from "next/link";
import { Headphones } from "lucide-react";
import { ArticleSearch } from "../components/ArticleSearch";
import { SiteShell } from "../components/SiteShell";
import { audioForDoc, fetchArticleAudioMap } from "../lib/site/audio";
import { feedUrl, loadSiteConfig } from "../lib/site/config";
import { loadPublicDocs } from "../lib/site/docs";

export const dynamic = "force-static";
export const revalidate = false;

export default async function HomePage() {
  const cfg = loadSiteConfig();
  const docs = loadPublicDocs();
  const audioMap = await fetchArticleAudioMap();
  const rss = feedUrl();
  const cards = docs.map((d) => ({
    slug: d.slug,
    title: d.title,
    date: d.date,
    audioUrl: audioForDoc(audioMap, d.filename),
  }));
  const withAudio = cards.filter((c) => c.audioUrl);
  const featured =
    withAudio.length >= 3
      ? withAudio.slice(0, 3)
      : [...withAudio, ...cards.filter((c) => !c.audioUrl)].slice(0, 3);

  return (
    <SiteShell
      siteTitle={cfg.siteTitle}
      feedUrl={rss}
      articleCount={docs.length}
      variant="public"
      hero={
        cfg.siteDescription ? (
          <section className="border-b border-border/70 bg-surface">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-8 px-4 py-10 sm:px-6 md:py-14">
              <img
                className="size-28 shrink-0 rounded-2xl object-cover shadow-[var(--shadow-card-hover)] ring-1 ring-border/80 sm:size-32"
                src={`/${cfg.coverImage}`}
                alt={`${cfg.siteTitle} cover`}
                width={128}
                height={128}
              />
              <div className="min-w-[200px] flex-1">
                <h1 className="font-serif text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
                  {cfg.siteTitle}
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-fg sm:text-base">
                  {cfg.siteDescription}
                </p>
                {rss ? (
                  <a
                    href={rss}
                    className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg no-underline transition-opacity hover:opacity-90"
                  >
                    <Headphones className="size-4" strokeWidth={1.75} />
                    Podcastを購読する
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        ) : null
      }
    >
      {featured.length > 0 ? (
        <section className="mb-12">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-fg">
            最新エピソード
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {featured.map((a, i) => (
              <Link
                key={a.slug}
                href={`/articles/${encodeURIComponent(a.slug)}`}
                className={
                  i === 0
                    ? "group flex flex-col justify-end rounded-[var(--radius-card)] border border-border bg-gradient-to-br from-muted/80 to-surface p-6 no-underline shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-card-hover)] md:col-span-2 md:min-h-[180px]"
                    : "group flex flex-col rounded-[var(--radius-card)] border border-border bg-surface p-5 no-underline shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-card-hover)]"
                }
              >
                <time className="text-xs tabular-nums text-muted-fg">{a.date}</time>
                <span
                  className={
                    i === 0
                      ? "mt-2 font-serif text-xl font-semibold leading-snug text-fg group-hover:text-fg/90"
                      : "mt-2 font-medium leading-snug text-fg group-hover:text-fg/90"
                  }
                >
                  {a.title}
                </span>
                {a.audioUrl ? (
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                    <Headphones className="size-3.5" strokeWidth={1.75} />
                    エピソードを聴く
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-fg">
        すべての記事 ({docs.length}件)
      </h2>
      <ArticleSearch articles={cards} />
    </SiteShell>
  );
}
