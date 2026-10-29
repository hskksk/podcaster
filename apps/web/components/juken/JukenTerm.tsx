/** Reader-only gloss: plushie wording + exam/historical term (not “heard” in dialogue). */
import type React from "react";

export function JukenTerm(props: { real: string; children?: React.ReactNode }) {
  return (
    <span className="j-term">
      {props.children}
      <span className="j-term-real" aria-label={`教材用語: ${props.real}`}>
        [{props.real}]
      </span>
    </span>
  );
}
