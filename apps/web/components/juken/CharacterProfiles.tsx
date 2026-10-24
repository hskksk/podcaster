import type { JukenCharacter } from "../../lib/juken/characters";

export function CharacterProfiles(props: { characters: readonly JukenCharacter[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {props.characters.map((character) => (
        <article
          key={character.id}
          id={character.id}
          data-tone={character.tone}
          className="scroll-mt-24 rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6"
        >
          <div className="flex items-start gap-4">
            <span className="j-avatar size-16 shrink-0 text-3xl" aria-hidden>
              {character.emoji}
            </span>
            <div className="min-w-0">
              <h2 className="font-serif text-2xl font-black tracking-tight">{character.name}</h2>
              <p className="mt-0.5 text-sm font-bold text-muted-fg">{character.species}</p>
              <p className="mt-2 text-sm font-bold text-accent">{character.tagline}</p>
            </div>
          </div>
          <p className="mt-4 text-[0.98rem] leading-relaxed">{character.intro}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {character.traits.map((trait) => (
              <li key={trait} className="j-chip">
                {trait}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
