import type { Metadata } from "next";
import type { ReactNode } from "react";

const description =
  "中学受験向けの学習ハブ。週次物語、歴史マップ、国語の選択肢問題を並べて読める。";

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
