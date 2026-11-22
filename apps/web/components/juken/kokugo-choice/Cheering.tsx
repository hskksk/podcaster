"use client";

import { CHARACTERS } from "../../../lib/juken/characters";
import type { Cheer } from "../../../lib/juken/kokugo-choice/cheers";
import { JukenSay } from "../JukenSay";

export function CheerLine(props: { cheer: Cheer }) {
  return <JukenSay character={props.cheer.character}>{props.cheer.text}</JukenSay>;
}

/** 9人が並んで、ぴょんぴょん跳ねている。動きを減らす設定のときは止める。 */
export function PlayingCrew() {
  return (
    <ul aria-label="ぬいぐるみたち" className="flex flex-wrap justify-center gap-2">
      {CHARACTERS.map((character, index) => (
        <li key={character.id} data-tone={character.tone}>
          <span
            className="j-avatar j-hop size-11 text-2xl"
            style={{ animationDelay: `${index * 0.12}s` }}
            title={character.name}
          >
            <span aria-hidden>{character.emoji}</span>
            <span className="sr-only">{character.name}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
