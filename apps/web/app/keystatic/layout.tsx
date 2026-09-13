import type { Metadata } from "next";
import KeystaticApp from "./keystatic";

export const metadata: Metadata = {
  title: "Keystatic · Podcaster",
  robots: { index: false, follow: false },
};

export default function KeystaticLayout() {
  return <KeystaticApp />;
}
