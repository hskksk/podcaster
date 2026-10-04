import type { Config, Schema } from "@markdoc/markdoc";

export type MarkdocExtensions = {
  nodes?: Record<string, Schema>;
  tags?: Record<string, Schema>;
  variables?: Config["variables"];
  functions?: Config["functions"];
};

/** App-specific Markdoc tags (Keystatic + public render). */
export const markdocExtensions: MarkdocExtensions = {
  tags: {
    podcastPlayer: {
      render: "PodcastPlayer",
      selfClosing: true,
      attributes: {
        episodeId: { type: String },
      },
    },
  },
};
