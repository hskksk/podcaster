import type { ReactNode } from "react";
import { childText } from "../../lib/markdoc-text";

export function Math(props: { display?: boolean; children?: ReactNode }) {
  const tex = childText(props.children).trim();
  if (props.display === false) {
    return <span className="math-inline">{`\\(${tex}\\)`}</span>;
  }
  return <div className="math-display">{`\\[${tex}\\]`}</div>;
}
