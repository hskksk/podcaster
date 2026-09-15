import { ArticleSearch } from "../components/ArticleSearch";
import { SiteShell } from "../components/SiteShell";
import { audioForDoc, fetchArticleAudioMap } from "../lib/site/audio";
import { feedUrl, loadSiteConfig } from "../lib/site/config";
import { loadPublicDocs } from "../lib/site/docs";

// GitHub Pages equivalent: bake HTML at `next build`. Vercel’s clone still
// has `content/` at build even when Root Directory is apps/web. `force-dynamic`
// was why the live site showed 0 articles (lambda has no content/).
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
    <div className="public-site">
      <SiteShell
        siteTitle={cfg.siteTitle}
        feedUrl={rss}
        articleCount={docs.length}
        hero={
          cfg.siteDescription ? (
            <section className="hero">
              <img className="hero-cover" src={`/${cfg.coverImage}`} alt={`${cfg.siteTitle} cover`} />
              <div className="hero-body">
                <p className="hero-title">{cfg.siteTitle}</p>
                <p className="hero-desc">{cfg.siteDescription}</p>
                {rss ? (
                  <a className="hero-subscribe" href={rss}>
                    📻 Podcastを購読する
                  </a>
                ) : null}
              </div>
            </section>
          ) : null
        }
      >
        {featured.length > 0 ? (
          <div className="featured-section">
            <p className="section-title">🆕 最新エピソード</p>
            <div className="featured-grid">
              {featured.map((a) => (
                <div className="featured-card" key={a.slug}>
                  <span className="card-date">{a.date}</span>
                  <a className="card-title" href={`/articles/${encodeURIComponent(a.slug)}`}>
                    {a.title}
                  </a>
                  {a.audioUrl ? (
                    <a className="card-audio" href={a.audioUrl}>
                      🎧 このエピソードを聴く
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <p className="section-title">すべての記事 ({docs.length}件)</p>
        <ArticleSearch articles={cards} />
      </SiteShell>
    </div>
  );
}
