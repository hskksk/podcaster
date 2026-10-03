"use client";

import {
  MarkdocView,
  createD2Renderer,
  createMermaidRenderer,
  type D2Like,
  type DiagramInput,
  type DiagramRenderer,
} from "@hskksk/markdoc-react";
import { useEffect, useMemo, useState } from "react";
import { markdocExtensions } from "../lib/markdoc/extensions";
import { createSiteShikiHighlighter } from "../lib/markdoc/shiki-highlighter";
import { Callout } from "./markdoc/Callout";
import { Heading } from "./markdoc/Heading";
import { PodcastPlayer } from "./markdoc/PodcastPlayer";
import { useTheme } from "./ThemeProvider";

const markdocComponents = {
  Callout,
  Heading,
  PodcastPlayer,
};

export function MarkdocBody({ source }: { source: string }) {
  const { resolved } = useTheme();
  const highlighter = useMemo(
    () => createSiteShikiHighlighter(resolved),
    [resolved],
  );

  const [diagramRenderer, setDiagramRenderer] = useState<DiagramRenderer | undefined>();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [{ default: mermaid }, { D2 }] = await Promise.all([
        import("mermaid"),
        import("@terrastruct/d2"),
      ]);
      if (cancelled) return;
      const mermaidRender = createMermaidRenderer(mermaid);
      const d2Render = createD2Renderer(new D2() as unknown as D2Like);
      setDiagramRenderer(async (input: DiagramInput) =>
        input.type === "d2" ? d2Render(input) : mermaidRender(input),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MarkdocView
      source={source}
      config={markdocExtensions}
      components={markdocComponents}
      fenceTags="document"
      highlighter={highlighter}
      diagramRenderer={diagramRenderer}
      theme={resolved}
    />
  );
}
