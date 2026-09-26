import type { Metadata } from "next";
import type { SiteConfig } from "./config";

export function ogImageUrls(images: NonNullable<Metadata["openGraph"]>["images"]): string[] | undefined {
  if (!images) return undefined;
  const list = Array.isArray(images) ? images : [images];
  return list.map((i) => {
    if (typeof i === "string") return i;
    if (i instanceof URL) return i.toString();
    return typeof i.url === "string" ? i.url : i.url.toString();
  });
}

export function siteOpenGraphDefaults(cfg: SiteConfig): NonNullable<Metadata["openGraph"]> {
  const base = cfg.siteUrl.replace(/\/$/, "");
  const image = base ? `${base}/${cfg.coverImage}` : `/${cfg.coverImage}`;
  return {
    type: "website",
    siteName: cfg.siteTitle,
    title: cfg.siteTitle,
    description: cfg.siteDescription || undefined,
    locale: "ja_JP",
    images: image ? [{ url: image, alt: cfg.siteTitle }] : undefined,
  };
}

export function articleOpenGraph(props: {
  cfg: SiteConfig;
  title: string;
  description: string;
  date?: string;
  /** Episode artwork; falls back to site cover when omitted. */
  imageUrl?: string;
}): Metadata {
  const og = siteOpenGraphDefaults(props.cfg);
  const imageOverride = props.imageUrl?.trim();
  const images = imageOverride
    ? [{ url: imageOverride, width: 1024, height: 1024, alt: props.title }]
    : og.images;
  return {
    title: props.title,
    description: props.description,
    openGraph: {
      ...og,
      type: "article",
      title: props.title,
      description: props.description,
      publishedTime: props.date,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: props.title,
      description: props.description,
      images: ogImageUrls(images),
    },
  };
}
