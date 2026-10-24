"use client";

"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { LessonCast } from "../../lib/juken/lesson-meta";

const JukenCastContext = createContext<LessonCast>({});

export function JukenCastProvider(props: { cast: LessonCast; children: ReactNode }) {
  return <JukenCastContext.Provider value={props.cast}>{props.children}</JukenCastContext.Provider>;
}

export function useJukenCast(): LessonCast {
  return useContext(JukenCastContext);
}
