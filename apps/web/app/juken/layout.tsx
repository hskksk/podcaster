import type { Metadata } from "next";
import type { ReactNode } from "react";

const description =
  "中学受験向けの学習ハブ。社会（歴史ものがたり・歴史マップ）と国語（選択肢問題）。";

export const metadata: Metadata = {
  title: { default: "ふしぎ旅", template: "%s | ふしぎ旅" },
  description,
  openGraph: {
    type: "website",
    siteName: "ふしぎ旅",
    title: "ふしぎ旅",
    description,
    locale: "ja_JP",
  },
  twitter: {
    card: "summary",
    title: "ふしぎ旅",
    description,
  },
};

export default function JukenLayout({ children }: { children: ReactNode }) {
  return children;
}
