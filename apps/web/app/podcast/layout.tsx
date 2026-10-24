import type { Metadata } from "next";
import type { ReactNode } from "react";
import { loadSiteConfig } from "../../lib/site/config";
import { ogImageUrls, siteOpenGraphDefaults } from "../../lib/site/open-graph";

export async function generateMetadata(): Promise<Metadata> {
  const cfg = loadSiteConfig();
  const og = siteOpenGraphDefaults(cfg);
  return {
    title: { default: cfg.siteTitle, template: `%s | ${cfg.siteTitle}` },
    description: cfg.siteDescription,
    openGraph: og,
    twitter: {
      card: "summary_large_image",
      title: cfg.siteTitle,
      description: cfg.siteDescription || undefined,
      images: ogImageUrls(og.images),
    },
  };
}

export default function PodcastLayout({ children }: { children: ReactNode }) {
  return children;
}
