"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

/** Side iframe preview on collection entry edit screens (local / saved content). */
export function LivePreviewPanel() {
  const pathname = usePathname();

  const previewSrc = useMemo(() => {
    if (!pathname) return null;
    const m = pathname.match(
      /^\/keystatic\/collection\/(docs|webClips)\/item\/([^/]+)(?:\/|$)/,
    );
    if (!m) return null;
    const collection = m[1] === "docs" ? "docs" : "webClips";
    const entry = decodeURIComponent(m[2]!);
    const params = new URLSearchParams({ collection, entry });
    return `/preview/start?${params.toString()}`;
  }, [pathname]);

  if (!previewSrc) return null;

  return (
    <div
      aria-label="Live preview"
      style={{
        position: "fixed",
        top: 56,
        right: 0,
        width: "min(42vw, 520px)",
        height: "calc(100vh - 56px)",
        borderLeft: "1px solid var(--ks-color-border, rgba(128,128,128,0.35))",
        background: "var(--ks-color-background, #111)",
        zIndex: 40,
        display: "none",
      }}
      className="keystatic-live-preview-panel"
    >
      <iframe
        title="Public site preview"
        src={previewSrc}
        style={{ width: "100%", height: "100%", border: 0 }}
      />
    </div>
  );
}
