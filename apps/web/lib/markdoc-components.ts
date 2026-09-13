import { fields } from "@keystatic/core";
import { block, wrapper } from "@keystatic/core/content-components";

export const markdocComponents = {
  callout: wrapper({
    label: "Callout",
    schema: {
      type: fields.select({
        label: "Type",
        options: [
          { label: "Note", value: "note" },
          { label: "Warning", value: "warning" },
          { label: "Error", value: "error" },
        ],
        defaultValue: "note",
      }),
    },
  }),
  diagram: wrapper({
    label: "Diagram",
    schema: {
      type: fields.select({
        label: "Type",
        options: [
          { label: "Mermaid", value: "mermaid" },
          { label: "D2", value: "d2" },
        ],
        defaultValue: "mermaid",
      }),
    },
  }),
  math: wrapper({
    label: "Math",
    schema: {
      display: fields.checkbox({ label: "Display block", defaultValue: true }),
    },
  }),
  podcastPlayer: block({
    label: "Podcast player",
    schema: {
      episodeId: fields.text({ label: "Episode ID" }),
    },
  }),
};

export const podcastSelect = fields.select({
  label: "Podcast",
  description: "none = knowledge only. queued triggers ingest (Phase 3).",
  options: [
    { label: "None", value: "none" },
    { label: "Queued", value: "queued" },
    { label: "Published", value: "published" },
    { label: "Skipped", value: "skipped" },
  ],
  defaultValue: "none",
});
