"use client";

import Markdoc, { type RenderableTreeNodes } from "@markdoc/markdoc";
import React, { useMemo } from "react";
import type { LessonCast } from "../../lib/juken/lesson-meta";
import { JukenCastProvider } from "./JukenCastContext";
import { JukenSay } from "./JukenSay";
import { JukenScene } from "./JukenScene";

const jukenComponents = {
  JukenSay,
  JukenScene,
};

function resolveTagName(name: string) {
  if (name === "JukenSay" || name === "JukenScene") return jukenComponents[name as keyof typeof jukenComponents];
  return name;
}

export function JukenMarkdocBody(props: { content: RenderableTreeNodes; cast: LessonCast }) {
  const body = useMemo(
    () =>
      Markdoc.renderers.react(props.content, React, {
        components: jukenComponents,
        resolveTagName,
      }),
    [props.content],
  );

  return <JukenCastProvider cast={props.cast}>{body}</JukenCastProvider>;
}
