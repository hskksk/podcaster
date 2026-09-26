import type { Metadata } from "next";
import { LivePreviewPanel } from "../../components/keystatic/LivePreviewPanel";
import KeystaticApp from "./keystatic";
import "./keystatic-admin.css";

export const metadata: Metadata = {
  title: "Keystatic · Podcaster",
  robots: { index: false, follow: false },
};

export default function KeystaticLayout() {
  return (
    <>
      <KeystaticApp />
      <LivePreviewPanel />
    </>
  );
}
