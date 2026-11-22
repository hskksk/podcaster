import type { ReactNode } from "react";

export function JukenScene(props: { children?: ReactNode }) {
  return <div className="j-scene">{props.children}</div>;
}
