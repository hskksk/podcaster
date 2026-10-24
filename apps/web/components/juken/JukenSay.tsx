"use client";

import { characterById, type CharacterId } from "../../lib/juken/characters";
import { useJukenCast } from "./JukenCastContext";

export function JukenSay(props: {
  character: string;
  note?: string;
  children?: React.ReactNode;
}) {
  const cast = useJukenCast();
  const id = props.character as CharacterId;
  const known = characterById(id);
  const speaker = known?.name ?? props.character;
  const tone = known?.tone ?? "neutral";
  const role = cast[id] ?? "";

  return (
    <div className="j-line" data-tone={tone}>
      <div className="j-avatar size-11 text-xl" aria-hidden>
        {known?.emoji ?? "💬"}
      </div>
      <div className="min-w-0">
        <p className="j-name">
          {speaker}
          {role ? <span className="j-role">{role}</span> : null}
        </p>
        <p className="j-say">{props.children}</p>
        {props.note ? <p className="j-note">{props.note}</p> : null}
      </div>
    </div>
  );
}
