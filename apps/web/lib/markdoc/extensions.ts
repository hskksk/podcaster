import type { MarkdocExtensions } from "@hskksk/markdoc-react/server";

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
