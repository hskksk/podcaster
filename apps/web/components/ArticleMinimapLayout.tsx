"use client";

import { MarkdocMinimap, extractMinimapOutline } from "@hskksk/markdoc-react";
import { useMemo, useRef, type ReactNode } from "react";
import { parseFrontmatter } from "../../../scripts/lib/mdoc";

export function ArticleMinimapLayout(props: { source: string; children: ReactNode }) {
  const scrollRef = useRef<HTMLElement>(null);
  const body = useMemo(() => parseFrontmatter(props.source).body, [props.source]);
  const sectionCount = useMemo(() => extractMinimapOutline(body).sections.length, [body]);

  if (sectionCount < 2) {
    return (
      <article
        className="mx-auto w-full min-w-0 max-w-3xl"
        data-pagefind-body
      >
        {props.children}
      </article>
    );
  }

  return (
    <div className="markdoc-reader article-minimap-layout mx-auto w-full min-w-0 max-w-6xl">
      <article
        ref={scrollRef}
        className="markdoc-reader__main mx-auto w-full min-w-0 max-w-3xl lg:mx-0"
        data-pagefind-body
      >
        {props.children}
      </article>
      <aside className="mx-auto w-full max-w-3xl lg:mx-0 lg:w-auto">
        <MarkdocMinimap source={body} scrollRoot={scrollRef} className="article-minimap" />
      </aside>
    </div>
  );
}
