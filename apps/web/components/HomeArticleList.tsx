"use client";

import Link from "next/link";
import { Headphones, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  filterArticles,
  filterCounts,
  groupArticlesByYear,
  type ArticleFilter,
} from "../lib/site/article-list-utils";
import { cn } from "../lib/cn";
import { articleHref } from "../lib/site/sanitize-content";
import type { ArticleCard } from "./ArticleSearch";

const tabs: { id: ArticleFilter; label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "audio", label: "音声あり" },
  { id: "recent", label: "90日以内" },
];

export function HomeArticleList(props: { articles: ArticleCard[] }) {
  const [filter, setFilter] = useState<ArticleFilter>("all");
  const [q, setQ] = useState("");
  const counts = useMemo(() => filterCounts(props.articles), [props.articles]);

  const filtered = useMemo(() => {
    let list = filterArticles(props.articles, filter);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((a) => a.title.toLowerCase().includes(needle));
    return list;
  }, [props.articles, filter, q]);

  const groups = useMemo(() => groupArticlesByYear(filtered), [filtered]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="記事フィルタ">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              filter === tab.id
                ? "border-fg/20 bg-fg text-bg"
                : "border-border bg-surface text-muted-fg hover:border-fg/15 hover:text-fg",
            )}
          >
            {tab.label}
            <span className="ml-1.5 tabular-nums opacity-70">{counts[tab.id]}</span>
          </button>
        ))}
      </div>

      <div className="relative mb-8">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-fg"
          strokeWidth={1.75}
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="タイトルで検索…"
          autoComplete="off"
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm shadow-sm placeholder:text-muted-fg focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/20 dark:focus:border-stone-500"
        />
      </div>

      {groups.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-fg">該当する記事がありません。</p>
      ) : (
        <div className="space-y-10">
          {groups.map((g) => (
            <section key={g.year}>
              <h3 className="mb-4 font-serif text-lg font-semibold text-fg">{g.year}</h3>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((a) => (
                  <li key={a.slug}>
                    <Link
                      href={articleHref(a.slug)}
                      className="group flex h-full flex-col rounded-[var(--radius-card)] border border-border bg-surface p-4 no-underline shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
                    >
                      <time className="text-xs tabular-nums text-muted-fg">{a.date}</time>
                      <span className="mt-2 flex-1 font-medium leading-snug text-fg">{a.title}</span>
                      {a.audioUrl ? (
                        <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                          <Headphones className="size-3.5" strokeWidth={1.75} />
                          聴く
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
