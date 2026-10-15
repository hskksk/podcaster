"use client";

import { type RefObject, useEffect, useState } from "react";

const DESKTOP_TREEMAP_DESIGN_WIDTH = 760;
const MOBILE_MINIMAP_MEDIA = "(max-width: 720px)";

function readMobileDesignWidth(container: HTMLElement): number {
  const width = container.clientWidth;
  return Math.max(320, Math.round(width));
}

function initialDesignWidth(): number {
  if (typeof window === "undefined") return DESKTOP_TREEMAP_DESIGN_WIDTH;
  if (!window.matchMedia(MOBILE_MINIMAP_MEDIA).matches) return DESKTOP_TREEMAP_DESIGN_WIDTH;
  return Math.max(320, Math.round(window.innerWidth));
}

/** Match treemap `designWidth` to the mobile minimap shell so tiles are not scaled down. */
export function useTreemapDesignWidth(containerRef: RefObject<HTMLElement | null>): number {
  const [designWidth, setDesignWidth] = useState(initialDesignWidth);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame = 0;
    const sync = () => {
      const mobile = window.matchMedia(MOBILE_MINIMAP_MEDIA).matches;
      if (!mobile) {
        setDesignWidth(DESKTOP_TREEMAP_DESIGN_WIDTH);
        return;
      }
      const next = readMobileDesignWidth(container);
      setDesignWidth((prev) => (prev === next ? prev : next));
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };

    const mq = window.matchMedia(MOBILE_MINIMAP_MEDIA);
    mq.addEventListener("change", schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(container);
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      mq.removeEventListener("change", schedule);
      ro.disconnect();
    };
  }, [containerRef]);

  return designWidth;
}
