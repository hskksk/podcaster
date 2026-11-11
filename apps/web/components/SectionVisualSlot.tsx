"use client";

import { SectionVisual, articleVisualEngine, type VisualEngineDefinition } from "@hskksk/markdoc-react";
import { useSectionVisuals } from "./SectionVisualsProvider";
import { useTheme } from "./ThemeProvider";

export function SectionVisualSlot(props: { sectionId: string }) {
  const visuals = useSectionVisuals();
  const { resolved } = useTheme();
  const entry = visuals?.bySectionId[props.sectionId];
  if (!entry) return null;
  return (
    <div className="article-section-visual-inline" data-nosnippet>
      <SectionVisual
        visual={entry}
        engines={[articleVisualEngine as VisualEngineDefinition<unknown>]}
        theme={resolved}
      />
    </div>
  );
}
