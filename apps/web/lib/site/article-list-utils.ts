import type { ArticleCard } from "../../components/ArticleSearch";

const RECENT_MS = 90 * 24 * 60 * 60 * 1000;

export type ArticleFilter = "all" | "audio" | "recent";

export function filterArticles(articles: ArticleCard[], filter: ArticleFilter): ArticleCard[] {
  if (filter === "audio") return articles.filter((a) => a.audioUrl);
  if (filter === "recent") {
    const cutoff = Date.now() - RECENT_MS;
    return articles.filter((a) => parseArticleDate(a.date) >= cutoff);
  }
  return articles;
}

export function filterCounts(articles: ArticleCard[]) {
  const cutoff = Date.now() - RECENT_MS;
  return {
    all: articles.length,
    audio: articles.filter((a) => a.audioUrl).length,
    recent: articles.filter((a) => parseArticleDate(a.date) >= cutoff).length,
  };
}

/** Parse YYYY-MM-DD or filename date prefixes; fallback 0 (sorted last in year groups). */
export function parseArticleDate(date: string): number {
  const iso = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Date.parse(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
  const compact = date.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) return Date.parse(`${compact[1]}-${compact[2]}-${compact[3]}T00:00:00Z`);
  const year = date.match(/(20\d{2})/);
  if (year) return Date.parse(`${year[1]}-01-01T00:00:00Z`);
  return 0;
}

export function yearFromDate(date: string): string {
  const y = date.match(/(20\d{2})/);
  return y ? y[1] : "その他";
}

export function groupArticlesByYear(articles: ArticleCard[]): { year: string; items: ArticleCard[] }[] {
  const map = new Map<string, ArticleCard[]>();
  for (const a of articles) {
    const y = yearFromDate(a.date);
    const list = map.get(y) ?? [];
    list.push(a);
    map.set(y, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === "その他") return 1;
      if (b === "その他") return -1;
      return b.localeCompare(a);
    })
    .map(([year, items]) => ({
      year,
      items: [...items].sort((x, y) => y.date.localeCompare(x.date, "en")),
    }));
}
