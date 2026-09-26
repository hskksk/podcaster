import { Tag, type Node, type Schema } from "@markdoc/markdoc";

function fenceDiagramSource(node: Node): { source: string; lang?: string } {
  for (const child of node.children) {
    if (child.type !== "fence") continue;
    const source = child.attributes.content;
    if (typeof source === "string" && source.length > 0) {
      const lang = child.attributes.language;
      return { source, lang: typeof lang === "string" ? lang : undefined };
    }
  }
  return { source: "" };
}

/** Same tag names as Keystatic `markdocComponents`. */
export const math: Schema = {
  render: "Math",
  attributes: {
    display: { type: Boolean, default: true },
  },
};

export const diagram: Schema = {
  render: "Diagram",
  attributes: {
    type: { type: String, default: "mermaid" },
    source: { type: String },
  },
  transform(node, config) {
    const attrs = node.transformAttributes(config);
    const { source, lang } = fenceDiagramSource(node);
    const type = lang === "d2" ? "d2" : (attrs.type as string) || "mermaid";
    return new Tag("Diagram", { ...attrs, type, source }, []);
  },
};

export const callout: Schema = {
  render: "Callout",
  attributes: {
    type: {
      type: String,
      default: "note",
      matches: ["note", "warning", "error"],
    },
  },
};

export const podcastPlayer: Schema = {
  render: "PodcastPlayer",
  selfClosing: true,
  attributes: {
    episodeId: { type: String },
  },
};
