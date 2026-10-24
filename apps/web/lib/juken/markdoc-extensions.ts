import type { MarkdocExtensions } from "@hskksk/markdoc-react/server";
import { CHARACTER_IDS } from "./characters";

const characterPattern = new RegExp(`^(${CHARACTER_IDS.join("|")})$`);

/** Markdoc schema for juken lesson bodies (not merged into wiki extensions). */
export const jukenMarkdocExtensions: MarkdocExtensions = {
  tags: {
    scene: {
      render: "JukenScene",
      attributes: {},
    },
    say: {
      render: "JukenSay",
      attributes: {
        character: {
          type: String,
          required: true,
          matches: characterPattern,
        },
        note: { type: String },
      },
    },
  },
};
