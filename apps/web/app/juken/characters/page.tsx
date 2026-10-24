import type { Metadata } from "next";
import Link from "next/link";
import { CharacterProfiles } from "../../../components/juken/CharacterProfiles";
import { JukenCrumbs, JukenShell } from "../../../components/juken/JukenShell";
import { CHARACTERS } from "../../../lib/juken/characters";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
  title: "ぬいぐるみ",
  description:
    "ふしぎ旅の登場人物。ぬいぐるみは9人。隔週ローテーションで4匹ずつ、週次の物語で歴史を歩く。",
};

export default function JukenCharactersPage() {
  return (
    <JukenShell variant="characters">
      <JukenCrumbs items={[{ href: "/juken", label: "ふしぎ旅" }, { label: "ぬいぐるみ" }]} />
      <h1 className="font-serif text-3xl font-black tracking-tight sm:text-4xl">ぬいぐるみ</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-fg">
        物語を読むのは小学5年生向けのテキストだけど、話しているのはぬいぐるみたち。全員男の子で、一人称はいつも自分の名前。
        1週間に登場するのは4匹まで（隔週ローテーション）。むずかしい言葉は会話の外に注記がある。
      </p>
      <div className="mt-8">
        <CharacterProfiles characters={CHARACTERS} />
      </div>
      <p className="mt-10 text-center text-sm font-bold text-muted-fg">
        <Link href="/juken" className="text-link no-underline hover:underline">
          物語の一覧へ
        </Link>
      </p>
    </JukenShell>
  );
}
