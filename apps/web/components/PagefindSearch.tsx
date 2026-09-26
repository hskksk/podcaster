"use client";

import { Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

type PagefindResult = {
  url: string;
  meta: { title?: string };
  excerpt: string;
};

type PagefindModule = {
  init: () => Promise<void>;
  search: (query: string) => Promise<{ results: { data: () => Promise<PagefindResult> }[] }>;
};

declare global {
  interface Window {
    pagefind?: PagefindModule;
  }
}

export function PagefindSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PagefindResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        if (!window.pagefind) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "/pagefind/pagefind.js";
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("pagefind load failed"));
            document.body.appendChild(s);
          });
        }
        await window.pagefind?.init();
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) {
          setError("検索インデックスがまだありません（本番ビルド後に有効になります）。");
        }
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = useCallback(
    async (query: string) => {
      if (!ready || !window.pagefind) return;
      const needle = query.trim();
      if (!needle) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await window.pagefind.search(needle);
        const items = await Promise.all(res.results.slice(0, 20).map((r) => r.data()));
        setResults(items);
      } finally {
        setLoading(false);
      }
    },
    [ready],
  );

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(q), 200);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q, runSearch]);

  return (
    <div>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-fg"
          strokeWidth={1.75}
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="全文検索（Pagefind）…"
          disabled={!ready && !error}
          className="w-full rounded-xl border border-border bg-surface py-3 pl-11 pr-10 text-base shadow-sm placeholder:text-muted-fg focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/20"
        />
        {q ? (
          <button
            type="button"
            aria-label="クリア"
            onClick={() => setQ("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-fg hover:text-fg"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-muted-fg">{error}</p> : null}
      {loading ? <p className="mt-6 text-sm text-muted-fg">検索中…</p> : null}

      <ul className="mt-8 space-y-4">
        {results.map((r) => (
          <li key={r.url}>
            <a
              href={r.url}
              className="block rounded-xl border border-border bg-surface p-4 no-underline shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-card-hover)]"
            >
              <span className="font-medium text-fg">{r.meta.title ?? r.url}</span>
              <p
                className="mt-2 text-sm leading-relaxed text-muted-fg"
                dangerouslySetInnerHTML={{ __html: r.excerpt }}
              />
            </a>
          </li>
        ))}
      </ul>

      {ready && q.trim() && !loading && results.length === 0 ? (
        <p className={cn("mt-8 text-center text-sm text-muted-fg")}>該当するページがありません。</p>
      ) : null}
    </div>
  );
}
