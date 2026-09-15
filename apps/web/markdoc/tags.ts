import type { Schema } from "@markdoc/markdoc";

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
