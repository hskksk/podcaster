import type { Metadata } from "next";
import Link from "next/link";
import { JukenCrumbs, JukenShell } from "../../../components/juken/JukenShell";
import { loadKokugoChoiceSets } from "../../../lib/juken/kokugo-choice/catalog";
import { LEVEL_LABELS } from "../../../lib/juken/kokugo-choice/schema";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
  title: "国語 選択肢問題",
  description: "短い文章を読んで、まちがいの選択肢を消していく練習問題。答え合わせでは、消す理由を本文の根拠つきで確かめられる。",
};

export default function KokugoChoiceIndexPage() {
  const sets = loadKokugoChoiceSets();

  return (
    <JukenShell variant="drill">
      <JukenCrumbs items={[{ href: "/juken", label: "ふしぎ旅" }, { label: "国語 選択肢問題" }]} />
      <p className="text-xs font-black tracking-[0.14em] text-accent">国語 · 消去法トレーニング</p>
      <h1 className="mt-2 font-serif text-4xl font-black tracking-tight">国語 選択肢問題</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-fg">
        短い文章を読んで、4つの選択肢から正解を選びます。まちがいだと思った選択肢は、右の ✕ で消していきます。答え合わせでは、どの選択肢がなぜまちがいなのかを、本文の根拠つきで確かめられます。
      </p>
      <h2 className="mb-4 mt-10 text-xs font-black tracking-[0.14em] text-muted-fg">問題セット</h2>
      {sets.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface px-4 py-10 text-center text-sm font-bold text-muted-fg">
          まだ問題がありません。
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {sets.map((set) => (
            <li key={set.id}>
              <Link
                href={set.href}
                className="block h-full rounded-[var(--radius-card)] border border-border bg-surface p-5 no-underline shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
              >
                <span className="font-serif text-xl font-black text-fg">{set.title}</span>
                <span className="mt-1 block text-sm font-bold text-muted-fg">{set.questions.length} 問</span>
                <span className="mt-3 flex flex-wrap gap-1.5">
                  {set.genreCounts.map((entry) => (
                    <span key={entry.genre} className="j-chip">
                      {entry.genre} {entry.count}
                    </span>
                  ))}
                  {set.levels.map((level) => (
                    <span key={level} className="j-chip">
                      {LEVEL_LABELS[level as 1 | 2 | 3]}
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </JukenShell>
  );
}
