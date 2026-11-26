import Link from "next/link";
import { JukenSubjectGrid } from "../../components/juken/JukenSubjectGrid";
import { JukenShell } from "../../components/juken/JukenShell";
import { CHARACTERS } from "../../lib/juken/characters";

export const dynamic = "force-static";
export const revalidate = false;

export default function JukenHomePage() {
  return (
    <JukenShell
      variant="home"
      hero={
        <section className="border-b border-border/70">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
            <p className="text-xs font-black tracking-[0.16em] text-accent">中学受験</p>
            <h1 className="mt-2 font-serif text-4xl font-black tracking-tight sm:text-5xl">ふしぎ旅</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-fg sm:text-lg">
              社会と国語の学習ハブです。科目ごとに箱を開いて、読みたいコンテンツへ進めます。
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {CHARACTERS.map((character) => (
                <li key={character.name}>
                  <Link
                    href={`/juken/characters#${character.id}`}
                    data-tone={character.tone}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1.5 pl-1.5 pr-3 text-sm font-bold text-fg no-underline shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-card-hover)]"
                  >
                    <span className="j-avatar size-9 text-lg" aria-hidden>
                      {character.emoji}
                    </span>
                    {character.name}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm font-bold">
              <Link href="/juken/characters" className="text-link no-underline hover:underline">
                ぬいぐるみの紹介
              </Link>
            </p>
          </div>
        </section>
      }
    >
      <JukenSubjectGrid density="full" />
    </JukenShell>
  );
}