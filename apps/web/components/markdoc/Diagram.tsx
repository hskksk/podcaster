"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { childDiagramSource } from "../../lib/markdoc-text";

export function Diagram(props: { type?: string; children?: ReactNode }) {
  const src = childDiagramSource(props.children).trim();
  const kind = props.type === "d2" ? "d2" : "mermaid";
  const containerRef = useRef<HTMLDivElement>(null);
  const salt = useId().replace(/:/g, "");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!src) return;
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    setError(null);
    setReady(false);
    el.innerHTML = "";

    void (async () => {
      try {
        if (kind === "d2") {
          const { D2 } = await import("@terrastruct/d2");
          const d2 = new D2();
          const result = await d2.compile(src);
          const svg = await d2.render(result.diagram, {
            ...result.renderOptions,
            salt,
            noXMLTag: true,
          });
          if (cancelled) return;
          el.innerHTML = svg;
        } else {
          const mermaid = (await import("mermaid")).default;
          mermaid.initialize({
            startOnLoad: false,
            theme: "neutral",
            securityLevel: "loose",
          });
          const id = `mmd-${salt}`;
          const { svg, bindFunctions } = await mermaid.render(id, src);
          if (cancelled) return;
          el.innerHTML = svg;
          bindFunctions?.(el);
        }
        if (!cancelled) setReady(true);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, kind, salt]);

  return (
    <figure className="diagram-figure">
      <div
        ref={containerRef}
        className={`diagram diagram-${kind}${ready ? " diagram-ready" : ""}`}
        data-diagram-type={kind}
        aria-busy={!ready && !error}
      />
      {error ? (
        <>
          <figcaption className="diagram-error" role="alert">
            {error}
          </figcaption>
          <pre className="diagram-source">
            <code>{src}</code>
          </pre>
        </>
      ) : null}
      <noscript>
        <pre className="diagram-source">
          <code>{src}</code>
        </pre>
      </noscript>
    </figure>
  );
}
