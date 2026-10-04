"use client";

import Markdoc, { type RenderableTreeNodes } from "@markdoc/markdoc";
import {
  MarkdocProvider,
  builtinComponents,
  createD2Renderer,
  createMermaidRenderer,
  type D2Like,
  type DiagramRenderer,
} from "@hskksk/markdoc-react";
import type { ComponentType, ReactNode } from "react";

type MarkdocComponent = ComponentType<any>;
type MarkdocComponents =
  | Record<string, MarkdocComponent>
  | ((name: string) => MarkdocComponent);
import React, { useEffect, useMemo, useState } from "react";
import { createSiteShikiHighlighter } from "../lib/markdoc/shiki-highlighter";
import { Callout } from "./markdoc/Callout";
import { Heading } from "./markdoc/Heading";
import { PodcastPlayer } from "./markdoc/PodcastPlayer";
import { useTheme } from "./ThemeProvider";

const siteComponents = {
  Callout,
  Heading,
  PodcastPlayer,
};

function MarkdocDocument({ children }: { children?: ReactNode }) {
  return <div className="markdoc-document">{children}</div>;
}

function resolveTagName(
  name: string,
  components: MarkdocComponents,
): string | MarkdocComponent {
  if (name === "article") return MarkdocDocument;
  if (typeof name !== "string") return name;
  if (name[0] !== name[0].toUpperCase()) return name;
  if (typeof components === "function") return components(name);
  return components[name] ?? name;
}

export function MarkdocContent({ content }: { content: RenderableTreeNodes }) {
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
      const renderDiagram: DiagramRenderer = async (input) => {
        if (!input) return { error: "Invalid diagram input" };
        return input.type === "d2" ? d2Render(input) : mermaidRender(input);
      };
      setDiagramRenderer(() => renderDiagram);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mergedComponents = useMemo(
    () => ({ ...builtinComponents, ...siteComponents }),
    [],
  );

  const body = useMemo(
    () =>
      Markdoc.renderers.react(content, React, {
        components: mergedComponents,
        resolveTagName,
      }),
    [content, mergedComponents],
  );

  return (
    <MarkdocProvider
      value={{
        highlighter,
        diagramRenderer,
        theme: resolved,
      }}
    >
      <div className="markdoc-root" data-markdoc-content="">
        {body}
      </div>
    </MarkdocProvider>
  );
}
