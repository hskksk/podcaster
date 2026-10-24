import type { ReactNode } from "react";

export function JukenScene(props: { children?: ReactNode }) {
  return <p className="j-scene">{props.children}</p>;
}
