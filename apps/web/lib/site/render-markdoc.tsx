import "server-only";

import Markdoc from "@markdoc/markdoc";
import React, { type ReactNode } from "react";
import { Callout } from "../../components/markdoc/Callout";
import { Diagram } from "../../components/markdoc/Diagram";
import { Math } from "../../components/markdoc/Math";
import { PodcastPlayer } from "../../components/markdoc/PodcastPlayer";
import schema from "../../markdoc/config";

const components = { Math, Diagram, Callout, PodcastPlayer };

export function renderMarkdoc(source: string): ReactNode {
  const ast = Markdoc.parse(source);
  const content = Markdoc.transform(ast, schema);
  return Markdoc.renderers.react(content, React, { components });
}
