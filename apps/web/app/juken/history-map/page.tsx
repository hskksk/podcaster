import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { HistoryMapApp } from "../../../components/juken/history-map/HistoryMapApp";
import { JukenCrumbs, JukenShell } from "../../../components/juken/JukenShell";
import { loadHistoryMapBundle } from "../../../lib/juken/history-map/load";

export const dynamic = "force-static";
export const revalidate = false;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export function generateMetadata(): Metadata {
  const bundle = loadHistoryMapBundle();
  if (!bundle) return { title: "歴史マップ" };
  return {
    title: bundle.meta.title,
    description: `${bundle.meta.subtitle}。地図と年表で出来事をたどる。`,
  };
}

export default function JukenHistoryMapPage() {
  const bundle = loadHistoryMapBundle();
  if (!bundle) notFound();

  return (
    <JukenShell variant="map" width="wide" immersive>
      <JukenCrumbs items={[{ href: "/juken", label: "ふしぎ旅" }, { label: bundle.meta.title }]} />
      <HistoryMapApp bundle={bundle} />
    </JukenShell>
  );
}