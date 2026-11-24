import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HistoryMapApp } from "../../../components/juken/history-map/HistoryMapApp";
import { JukenCrumbs, JukenShell } from "../../../components/juken/JukenShell";
import { ensureKnowledgeContentForRender } from "../../../lib/knowledge/ensure-content";
import { loadHistoryMapBundle } from "../../../lib/juken/history-map/load";

export const dynamic = "force-static";
export const revalidate = false;

export async function generateMetadata(): Promise<Metadata> {
  await ensureKnowledgeContentForRender();
  const bundle = loadHistoryMapBundle();
  if (!bundle) return { title: "歴史マップ" };
  return {
    title: bundle.meta.title,
    description: `${bundle.meta.subtitle}。地図と年表で出来事をたどる。`,
  };
}

export default async function JukenHistoryMapPage() {
  await ensureKnowledgeContentForRender();
  const bundle = loadHistoryMapBundle();
  if (!bundle) notFound();

  return (
    <JukenShell variant="map" width="wide">
      <JukenCrumbs items={[{ href: "/juken", label: "ふしぎ旅" }, { label: bundle.meta.title }]} />
      <HistoryMapApp bundle={bundle} />
    </JukenShell>
  );
}