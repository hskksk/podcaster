"use client";

import { MarkdocTreemap, extractMinimapOutline } from "@hskksk/markdoc-react";
import { useCallback, useMemo, useRef, type ReactNode } from "react";
import { parseFrontmatter } from "../../../scripts/lib/mdoc";
import { useTheme } from "./ThemeProvider";

export function ArticleMinimapLayout(props: { source: string; children: ReactNode }) {
  const scrollRef = useRef<HTMLElement>(null);
  const { resolved } = useTheme();
  const body = useMemo(() => parseFrontmatter(props.source).body, [props.source]);
  const sectionCount = useMemo(() => extractMinimapOutline(body).sections.length, [body]);

  const onTreemapSelect = useCallback(
    (detail: { id: string; title: string; line?: number }) => {
      const root = scrollRef.current;
      if (!root) return;
      const byId = root.querySelector(`#${CSS.escape(detail.id)}`);
      if (byId) {
        byId.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const target = detail.title.trim();
      for (const heading of root.querySelectorAll(".markdoc-heading")) {
        if (heading.textContent?.trim() === target) {
          heading.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }
    },
    [],
  );

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
    <div
      className="markdoc-reader article-minimap-layout mx-auto w-full min-w-0 max-w-6xl"
      data-minimap-variant="treemap"
    >
      <article
        ref={scrollRef}
        className="markdoc-reader__main mx-auto w-full min-w-0 max-w-3xl lg:mx-0"
        data-pagefind-body
      >
        {props.children}
      </article>
      <MarkdocTreemap
        source={body}
        mode="minimap"
        theme={resolved}
        scrollRoot={scrollRef}
        onSelect={onTreemapSelect}
        className="article-minimap"
      />
    </div>
  );
}
