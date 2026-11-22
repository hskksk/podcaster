import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChoiceDrill } from "../../../../components/juken/kokugo-choice/ChoiceDrill";
import { JukenCrumbs, JukenShell } from "../../../../components/juken/JukenShell";
import { drillIndexHref } from "../../../../lib/juken/kokugo-choice/load";
import { findKokugoChoiceSet, loadKokugoChoiceSets } from "../../../../lib/juken/kokugo-choice/catalog";

export const dynamic = "force-static";
export const revalidate = false;
export const dynamicParams = false;

type Params = { set: string };

export function generateStaticParams() {
  return loadKokugoChoiceSets().map((set) => ({ set: set.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { set: setId } = await params;
  const set = findKokugoChoiceSet(setId);
  if (!set) return { title: "見当たりません" };
  return { title: `国語 選択肢問題 ${set.title}`, description: `${set.questions.length} 問の選択肢問題` };
}

export default async function KokugoChoiceSetPage({ params }: { params: Promise<Params> }) {
  const { set: setId } = await params;
  const set = findKokugoChoiceSet(setId);
  if (!set) notFound();

  return (
    <JukenShell variant="drill">
      <JukenCrumbs
        items={[
          { href: "/juken", label: "ふしぎ旅" },
          { href: drillIndexHref(), label: "国語 選択肢問題" },
          { label: set.title },
        ]}
      />
      <p className="text-xs font-black tracking-[0.14em] text-accent">国語 · 消去法トレーニング</p>
      <h1 className="mt-2 font-serif text-3xl font-black tracking-tight sm:text-4xl">{set.title}</h1>
      <p className="mb-8 mt-3 max-w-2xl text-sm leading-relaxed text-muted-fg">
        本文を読み、選択肢を1つ選んで「答え合わせ」を押します。まちがいだと思う選択肢は、右の ✕ で消せます。
      </p>
      <ChoiceDrill questions={set.questions} />
    </JukenShell>
  );
}
