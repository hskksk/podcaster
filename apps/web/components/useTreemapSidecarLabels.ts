"use client";

import { type RefObject, useEffect } from "react";
import type { TreemapLabels } from "../lib/site/treemap-labels-types";

/** Apply precomputed treemap.yml labels to mounted treemap tiles (markdoc-react has no sync labels prop yet). */
export function useTreemapSidecarLabels(
  containerRef: RefObject<HTMLElement | null>,
  labels: TreemapLabels | null | undefined,
) {
  useEffect(() => {
    if (!labels || Object.keys(labels).length === 0) return;
    const root = containerRef.current;
    if (!root) return;

    const host = root.querySelector<HTMLElement>(".markdoc-treemap-host");
    if (!host) return;

    const apply = () => {
      for (const [id, label] of Object.entries(labels)) {
        if (!label.title?.trim() && !label.subtitle?.trim()) continue;
        const escaped = CSS.escape(id);
        for (const el of host.querySelectorAll<HTMLElement>(`[data-id="${escaped}"]`)) {
          if (label.title?.trim()) {
            const bold = el.matches(".tm-tile")
              ? el.querySelector("b")
              : el.querySelector("b") ?? (el.tagName === "H2" || el.tagName === "H3" ? el : null);
            if (bold) bold.textContent = label.title.trim();
          }
          if (label.subtitle?.trim()) {
            const small = el.querySelector("small");
            if (small) small.textContent = label.subtitle.trim();
          }
        }
      }
    };

    apply();
    const observer = new MutationObserver(() => apply());
    observer.observe(host, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [containerRef, labels]);
}
