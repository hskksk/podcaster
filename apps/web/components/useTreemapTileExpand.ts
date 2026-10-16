"use client";

import { type RefObject, useEffect, useRef } from "react";

function chevronSvg(down: boolean): string {
  const d = down ? "M4 6l4 4 4-4" : "M4 10l4-4 4 4";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

function tileHasExpandableBody(tile: HTMLElement): boolean {
  const small = tile.querySelector("small");
  const text = small?.textContent?.trim() ?? "";
  return text.length > 0;
}

function setExpanded(tile: HTMLElement, btn: HTMLButtonElement, expanded: boolean) {
  if (expanded) {
    tile.setAttribute("data-tile-expanded", "true");
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-label", "要約を閉じる");
    btn.innerHTML = chevronSvg(false);
  } else {
    tile.removeAttribute("data-tile-expanded");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "要約を開く");
    btn.innerHTML = chevronSvg(true);
  }
}

function enhanceTreemapTiles(host: HTMLElement, expandedIds: Set<string>) {
  for (const tile of host.querySelectorAll<HTMLElement>(".tm-tile")) {
    const id = tile.dataset.id;
    if (!id) continue;

    const canExpand = tileHasExpandableBody(tile);
    let btn = tile.querySelector<HTMLButtonElement>(".tm-tile-expand");

    if (!canExpand) {
      tile.removeAttribute("data-tile-expanded");
      btn?.remove();
      continue;
    }

    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tm-tile-expand";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        const next = !tile.hasAttribute("data-tile-expanded");
        if (id) {
          if (next) expandedIds.add(id);
          else expandedIds.delete(id);
        }
        setExpanded(tile, btn!, next);
      });
      tile.append(btn);
    }

    setExpanded(tile, btn, expandedIds.has(id));
  }
}

/**
 * Collapsible tile body (subtitle): compact one line by default, expand via top-right control.
 */
export function useTreemapTileExpand(
  containerRef: RefObject<HTMLElement | null>,
  treemapRevision: string,
) {
  const expandedIds = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      const host = containerRef.current?.querySelector<HTMLElement>(".markdoc-treemap-host");
      if (!host) return;
      enhanceTreemapTiles(host, expandedIds.current);
    };

    run();
    const t1 = window.setTimeout(run, 120);
    const t2 = window.setTimeout(run, 480);

    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [containerRef, treemapRevision]);
}
