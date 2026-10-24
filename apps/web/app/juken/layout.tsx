import type { Metadata } from "next";
import type { ReactNode } from "react";

const description =
  "中学受験の家庭学習用に書いた、一週間五本の物語。くまぴーたちがテキストの範囲を会話で歩く。";

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
