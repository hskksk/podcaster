import "server-only";

import type { RenderableTreeNodes } from "@markdoc/markdoc";
import { parseLessonFile } from "./lesson-meta";
import { transformJukenBody } from "./markdoc-transform";

export type PreparedJukenMarkdoc = {
  content: RenderableTreeNodes;
  body: string;
};

export function prepareJukenMarkdoc(source: string): PreparedJukenMarkdoc {
  const { body } = parseLessonFile(source);
  const content = transformJukenBody(body);
  return { content, body };
}
