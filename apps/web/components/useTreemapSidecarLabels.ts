"use client";

import { type RefObject, useEffect } from "react";
import type { TreemapLabels } from "../lib/site/treemap-labels-types";

function applyTitleOverrides(host: HTMLElement, labels: TreemapLabels) {
  for (const [id, label] of Object.entries(labels)) {
    const title = label.title?.trim();
    if (!title) continue;
    const escaped = CSS.escape(id);
    for (const el of host.querySelectorAll<HTMLElement>(`[data-id="${escaped}"]`)) {
      const bold =
        el.matches(".tm-tile")
          ? el.querySelector("b")
          : el.querySelector("b") ?? (el.tagName === "H2" || el.tagName === "H3" ? el : null);
      if (bold && bold.textContent !== title) bold.textContent = title;
    }
  }
}

/**
 * Patch tile titles from treemap.yml (subtitles go through createStaticTreemapAi).
 * No MutationObserver — treemap re-renders on scroll/resize and would fight an observer loop.
 */
export function useTreemapSidecarTitleOverrides(
  containerRef: RefObject<HTMLElement | null>,
  labels: TreemapLabels | null | undefined,
  /** Remount when treemap re-inits (design width, source, theme). */
  treemapRevision: string,
) {
  useEffect(() => {
    if (!labels || Object.keys(labels).length === 0) return;

    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      const host = containerRef.current?.querySelector<HTMLElement>(".markdoc-treemap-host");
      if (!host) return;
      applyTitleOverrides(host, labels);
    };

    apply();
    const t1 = window.setTimeout(apply, 120);
    const t2 = window.setTimeout(apply, 480);

    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [containerRef, labels, treemapRevision]);
}
