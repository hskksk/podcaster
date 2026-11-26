import Link from "next/link";
import { Headphones } from "lucide-react";
import { JukenSubjectGrid } from "../components/juken/JukenSubjectGrid";
import { loadSiteConfig } from "../lib/site/config";
import { loadPublicDocs } from "../lib/site/docs";
import { articleHref } from "../lib/site/sanitize-content";

export const dynamic = "force-static";
export const revalidate = false;

export default function PortalPage() {
  const cfg = loadSiteConfig();
  const docs = loadPublicDocs().slice(0, 3);

  return (
    <div className="portal flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <span className="font-serif text-lg font-semibold tracking-tight">hskksk</span>
        <span className="text-xs font-medium tracking-wide text-muted-fg">記事と、家で読む一週間</span>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
        <section className="max-w-3xl pt-6 sm:pt-12">
          <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            調べた記事と、
            <br />
            家で読む一週間。
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-fg sm:text-lg">
            ポッドキャストと、中学受験のふしぎ旅。入口はここです。
          </p>
        </section>

        <div className="mt-10 grid items-stretch gap-5 lg:mt-14 lg:grid-cols-2">
          <article className="podcast-theme flex flex-col rounded-[1.75rem] border border-border p-6 shadow-[var(--shadow-card)] sm:p-8">
            <div className="flex items-start gap-4">
              <img
                src={`/${cfg.coverImage}`}
                alt=""
                width={88}
                height={88}
                className="size-20 shrink-0 rounded-2xl object-cover ring-1 ring-border sm:size-24"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Podcast</p>
                <h2 className="mt-2 font-serif text-2xl font-semibold leading-snug tracking-tight">
                  <Link href="/podcast" className="text-fg no-underline hover:underline">
                    {cfg.siteTitle}
                  </Link>
                </h2>
              </div>
            </div>
            {cfg.siteDescription ? (
              <p className="mt-5 text-sm leading-relaxed text-muted-fg sm:text-base">{cfg.siteDescription}</p>
            ) : null}
            <div className="pt-6">
              <Link
                href="/podcast"
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg no-underline transition hover:opacity-90"
              >
                <Headphones className="size-4" strokeWidth={1.75} />
                記事と音声を開く
              </Link>
            </div>
            {docs.length > 0 ? (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-fg">新着</p>
                <ul className="mt-2 space-y-2">
                  {docs.map((doc) => (
                    <li key={doc.slug}>
                      <Link
                        href={articleHref(doc.slug)}
                        className="flex items-baseline justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 no-underline transition hover:shadow-[var(--shadow-card)]"
                      >
                        <span className="font-medium leading-snug text-fg">{doc.title}</span>
                        <time className="shrink-0 text-xs tabular-nums text-muted-fg">{doc.date}</time>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>

          <article className="juken flex flex-col rounded-[1.75rem] border border-border p-6 shadow-[var(--shadow-card)] sm:p-8">
            <p className="text-xs font-black tracking-[0.16em] text-accent">中学受験</p>
            <h2 className="mt-2 font-serif text-3xl font-black tracking-tight">
              <Link href="/juken" className="text-fg no-underline hover:underline">
                ふしぎ旅
              </Link>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-fg sm:text-base">
              ぬいぐるみたちと一緒に、中学受験 社会、国語 の勉強ができます。
            </p>
            <div className="mt-6">
              <JukenSubjectGrid density="compact" />
            </div>
          </article>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-sm text-muted-fg sm:px-6">
        <p>© {new Date().getFullYear()} hskksk</p>
      </footer>
    </div>
  );
}