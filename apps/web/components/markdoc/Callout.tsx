import type { ReactNode } from "react";

export function Callout(props: { type?: string; children?: ReactNode }) {
  const type = props.type || "note";
  return <aside className={`callout callout-${type}`}>{props.children}</aside>;
}
