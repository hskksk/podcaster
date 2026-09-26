import { fields } from "@keystatic/core";
import { block, wrapper } from "@keystatic/core/content-components";

function CalloutPreview(props: { type: "note" | "warning" | "error"; children?: React.ReactNode }) {
  const styles = {
    note: { border: "1px solid #3b82f6", background: "rgba(59,130,246,0.08)" },
    warning: { border: "1px solid #f59e0b", background: "rgba(245,158,11,0.1)" },
    error: { border: "1px solid #ef4444", background: "rgba(239,68,68,0.08)" },
  } as const;
  const s = styles[props.type];
  return (
    <div style={{ ...s, borderRadius: 8, padding: "10px 12px", margin: "8px 0", fontSize: 14 }}>
      <div style={{ fontWeight: 600, marginBottom: 4, textTransform: "capitalize" }}>{props.type}</div>
      <div>{props.children ?? "…"}</div>
    </div>
  );
}

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
    ContentView: (props) => (
      <CalloutPreview type={props.value.type as "note" | "warning" | "error"}>
        {props.children}
      </CalloutPreview>
    ),
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
    ContentView: (props) => (
      <div
        style={{
          border: "1px dashed var(--ks-color-border, #888)",
          borderRadius: 8,
          padding: 12,
          margin: "8px 0",
          fontFamily: "monospace",
          fontSize: 13,
        }}
      >
        {props.value.type === "d2" ? "D2 diagram" : "Mermaid diagram"}
        {props.children ? <div style={{ marginTop: 8 }}>{props.children}</div> : null}
      </div>
    ),
  }),
  math: wrapper({
    label: "Math",
    schema: {
      display: fields.checkbox({ label: "Display block", defaultValue: true }),
    },
    ContentView: (props) => (
      <div
        style={{
          fontFamily: "serif",
          fontStyle: "italic",
          padding: props.value.display ? "12px 0" : 0,
          textAlign: props.value.display ? "center" : "inherit",
        }}
      >
        {props.children ?? "∑ …"}
      </div>
    ),
  }),
  podcastPlayer: block({
    label: "Podcast player",
    schema: {
      episodeId: fields.text({ label: "Episode ID" }),
    },
    ContentView: (props) => (
      <div
        style={{
          border: "1px solid var(--ks-color-border, #888)",
          borderRadius: 8,
          padding: "10px 12px",
          margin: "8px 0",
          fontSize: 14,
        }}
      >
        Podcast player
        {props.value.episodeId ? ` · episode ${props.value.episodeId}` : ""}
      </div>
    ),
  }),
};

export const podcastSelect = fields.select({
  label: "Podcast",
  description:
    "none = ナレッジのみ。queued は GitHub Actions が ingest し、成功後 published に書き戻します。",
  options: [
    { label: "None", value: "none" },
    { label: "Queued", value: "queued" },
    { label: "Published", value: "published" },
    { label: "Skipped", value: "skipped" },
  ],
  defaultValue: "none",
});
