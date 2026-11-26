import type { ReactNode } from "react";

export function MobileStatusBar(props: { era: string; children: ReactNode }) {
  return (
    <div className="hm-sbar">
      <div className="hm-era">{props.era}</div>
      {props.children}
    </div>
  );
}
