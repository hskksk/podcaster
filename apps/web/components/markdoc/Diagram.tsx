import type { ReactNode } from "react";
import { childText } from "../../lib/markdoc-text";

export function Diagram(props: { type?: string; children?: ReactNode }) {
  const src = childText(props.children).trim();
  const kind = props.type || "mermaid";
  return (
    <pre className={kind === "mermaid" ? "mermaid" : undefined}>
      <code>{src}</code>
    </pre>
  );
}
