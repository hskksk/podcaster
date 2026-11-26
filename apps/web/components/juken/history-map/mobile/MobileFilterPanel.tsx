import type { ReactNode } from "react";

export function MobileFilterPanel(props: { children: ReactNode }) {
  return (
    <div className="hm-fpanel" id="hm-fpanel">
      {props.children}
    </div>
  );
}
