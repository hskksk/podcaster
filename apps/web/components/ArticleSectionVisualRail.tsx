"use client";

import {
  SectionVisual,
  articleVisualEngine,
  extractMinimapOutline,
  type VisualEngineDefinition,
} from "@hskksk/markdoc-react";
import { useEffect, useMemo, useState, type RefObject } from "react";
import type { SectionVisualsContent } from "../lib/site/section-visuals-types";
import { useTheme } from "./ThemeProvider";
import { parseFrontmatter } from "../../../scripts/lib/mdoc";

function resolveVisualSectionId(
  activeId: string,
  sections: { id: string; level: number }[],
  bySectionId: Record<string, unknown>,
): string | null {
  const index = sections.findIndex((s) => s.id === activeId);
  if (index < 0) return null;
  for (let i = index; i >= 0; i--) {
    const id = sections[i].id;
    if (bySectionId[id]) return id;
    if (sections[i].level <= 2 && i < index) break;
  }
  return null;
}

export function ArticleSectionVisualRail(props: {
  source: string;
  visuals: SectionVisualsContent;
  scrollRoot: RefObject<HTMLElement | null>;
}) {
  const { resolved } = useTheme();
  const body = useMemo(() => parseFrontmatter(props.source).body, [props.source]);
  const sections = useMemo(() => extractMinimapOutline(body).sections, [body]);
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const [visibleId, setVisibleId] = useState<string | null>(null);

  useEffect(() => {
    const root = props.scrollRoot.current;
    if (!root || sections.length === 0) return;

    const headings = sections
      .map((section) => {
        const el = root.querySelector(`#${CSS.escape(section.id)}`);
        return el ? { id: section.id, el } : null;
      })
      .filter((row): row is { id: string; el: Element } => row != null);

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length === 0) return;
        const top = visible[0].target;
        const hit = headings.find((h) => h.el === top);
        if (hit) setActiveId(hit.id);
      },
      { root: null, rootMargin: "-20% 0px -65% 0px", threshold: [0, 1] },
    );

    for (const { el } of headings) observer.observe(el);
    return () => observer.disconnect();
  }, [props.scrollRoot, sections]);

  useEffect(() => {
    setVisibleId(resolveVisualSectionId(activeId, sections, props.visuals.bySectionId));
  }, [activeId, sections, props.visuals.bySectionId]);

  const entry = visibleId ? props.visuals.bySectionId[visibleId] : null;

  return (
    <aside
      className="article-section-visual-rail"
      aria-hidden={!entry}
      data-nosnippet
    >
      {entry ? (
        <div className="article-section-visual-rail__panel" key={visibleId}>
          <SectionVisual
            visual={entry}
            engines={[articleVisualEngine as VisualEngineDefinition<unknown>]}
            theme={resolved}
          />
        </div>
      ) : null}
    </aside>
  );
}
