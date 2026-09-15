"use client";

import { useMemo, useState } from "react";

export type ArticleCard = {
  slug: string;
  title: string;
  date: string;
  audioUrl?: string;
};

export function ArticleSearch(props: {
  articles: ArticleCard[];
  basePath?: string;
  searchPlaceholder?: string;
}) {
  const basePath = props.basePath ?? "/articles";
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return props.articles;
    return props.articles.filter((a) => a.title.toLowerCase().includes(needle));
  }, [props.articles, q]);

  return (
    <>
      <div className="search-box">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={props.searchPlaceholder ?? "🔍 記事を検索..."}
          autoComplete="off"
        />
      </div>
      <div className="article-grid">
        {filtered.map((a) => (
          <div className="article-card" key={a.slug}>
            <span className="card-date">{a.date}</span>
            <a className="card-title" href={`${basePath}/${encodeURIComponent(a.slug)}`}>
              {a.title}
            </a>
            {a.audioUrl ? (
              <a className="card-audio" href={a.audioUrl}>
                🎧 聴く
              </a>
            ) : null}
          </div>
        ))}
      </div>
      {filtered.length === 0 && q.trim() ? (
        <p className="no-results" style={{ display: "block" }}>
          該当する記事が見つかりませんでした。
        </p>
      ) : null}
    </>
  );
}
