"use client";

import { MarkdocTreemap, extractMinimapOutline } from "@hskksk/markdoc-react";
import { ChevronDown, ChevronUp, Map } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { parseFrontmatter } from "../../../scripts/lib/mdoc";
import { useTheme } from "./ThemeProvider";
import type { TreemapSidecarContent } from "../lib/site/treemap-labels-types";
import { useTreemapDesignWidth } from "./useTreemapDesignWidth";
import { createStaticTreemapAi } from "../lib/treemap/createStaticTreemapAi";
import { useTreemapSidecarTitleOverrides } from "./useTreemapSidecarLabels";
import { useTreemapTileExpand } from "./useTreemapTileExpand";

export function ArticleMinimapLayout(props: {
  source: string;
  treemapSidecar?: TreemapSidecarContent | null;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLElement>(null);
  const mobileMinimapShellRef = useRef<HTMLDivElement>(null);
  const treemapPanelRef = useRef<HTMLDivElement>(null);
  const treemapDesignWidth = useTreemapDesignWidth(treemapPanelRef);
  const [mobileMinimapCollapsed, setMobileMinimapCollapsed] = useState(true);
  const { resolved } = useTheme();
  const body = useMemo(() => parseFrontmatter(props.source).body, [props.source]);
  const sectionCount = useMemo(() => extractMinimapOutline(body).sections.length, [body]);
  const treemapAi = useMemo(
    () => createStaticTreemapAi(props.treemapSidecar),
    [props.treemapSidecar],
  );
  const treemapRevision = `${body.length}:${treemapDesignWidth}:${resolved}`;
  useTreemapSidecarTitleOverrides(
    treemapPanelRef,
    props.treemapSidecar?.nodes,
    treemapRevision,
  );
  useTreemapTileExpand(treemapPanelRef, treemapRevision);

  const onTreemapSelect = useCallback(
    (detail: { id: string; title: string; line?: number }) => {
      const root = scrollRef.current;
      if (!root) return;
      const byId = root.querySelector(`#${CSS.escape(detail.id)}`);
      if (byId) {
        byId.scrollIntoView({ behavior: "smooth", block: "start" });
        setMobileMinimapCollapsed(true);
        return;
      }
      const target = detail.title.trim();
      for (const heading of root.querySelectorAll(".markdoc-heading")) {
        if (heading.textContent?.trim() === target) {
          heading.scrollIntoView({ behavior: "smooth", block: "start" });
          setMobileMinimapCollapsed(true);
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
      data-minimap-collapsed={mobileMinimapCollapsed ? "true" : undefined}
    >
      <article
        ref={scrollRef}
        className="markdoc-reader__main mx-auto w-full min-w-0 max-w-3xl lg:mx-0"
        data-pagefind-body
      >
        {props.children}
      </article>
      <div ref={mobileMinimapShellRef} className="article-minimap-mobile">
        <button
          type="button"
          className="article-minimap-mobile-toggle"
          aria-expanded={!mobileMinimapCollapsed}
          aria-controls="article-minimap-panel"
          onClick={() => setMobileMinimapCollapsed((collapsed) => !collapsed)}
        >
          <span className="article-minimap-mobile-toggle__label">
            <Map className="size-4 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
            章マップ
          </span>
          {mobileMinimapCollapsed ? (
            <ChevronDown className="size-4 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
          ) : (
            <ChevronUp className="size-4 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
          )}
        </button>
        <div id="article-minimap-panel" ref={treemapPanelRef}>
          <MarkdocTreemap
            source={body}
            mode="minimap"
            theme={resolved}
            designWidth={treemapDesignWidth}
            ai={treemapAi}
            scrollRoot={scrollRef}
            onSelect={onTreemapSelect}
            className="article-minimap"
          />
        </div>
      </div>
    </div>
  );
}
