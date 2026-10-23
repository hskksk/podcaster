"use client";

import { type RefObject, useEffect, useState } from "react";

const MIN_TREEMAP_DESIGN_WIDTH = 280;
const FALLBACK_TREEMAP_DESIGN_WIDTH = 360;

function readHostDesignWidth(host: HTMLElement): number {
  const width = host.clientWidth;
  return Math.max(MIN_TREEMAP_DESIGN_WIDTH, Math.round(width));
}

function initialDesignWidth(): number {
  if (typeof window === "undefined") return FALLBACK_TREEMAP_DESIGN_WIDTH;
  return Math.max(MIN_TREEMAP_DESIGN_WIDTH, Math.round(window.innerWidth));
}

/**
 * Match treemap `designWidth` to the rendered host width so minimap mode does not
 * scale content down (desktop sidebar uses `display: contents`, so measure `.markdoc-treemap-host`).
 */
export function useTreemapDesignWidth(panelRef: RefObject<HTMLElement | null>): number {
  const [designWidth, setDesignWidth] = useState(initialDesignWidth);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    const sync = (host: HTMLElement) => {
      const next = readHostDesignWidth(host);
      setDesignWidth((prev) => (prev === next ? prev : next));
    };

    const attach = (host: HTMLElement) => {
      const schedule = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => sync(host));
      };
      resizeObserver = new ResizeObserver(schedule);
      resizeObserver.observe(host);
      schedule();
    };

    const host = panel.querySelector<HTMLElement>(".markdoc-treemap-host");
    if (host) {
      attach(host);
    } else {
      mutationObserver = new MutationObserver(() => {
        const nextHost = panel.querySelector<HTMLElement>(".markdoc-treemap-host");
        if (!nextHost) return;
        mutationObserver?.disconnect();
        mutationObserver = null;
        attach(nextHost);
      });
      mutationObserver.observe(panel, { childList: true, subtree: true });
    }

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [panelRef]);

  return designWidth;
}
