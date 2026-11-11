"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SectionVisualsContent } from "../lib/site/section-visuals-types";

const SectionVisualsContext = createContext<SectionVisualsContent | null>(null);

export function SectionVisualsProvider(props: { visuals: SectionVisualsContent | null; children: ReactNode }) {
  return (
    <SectionVisualsContext.Provider value={props.visuals}>{props.children}</SectionVisualsContext.Provider>
  );
}

export function useSectionVisuals() {
  return useContext(SectionVisualsContext);
}
