/**
 * Resolve Wikimedia portrait thumbnails for history-map figures manifest.
 * Usage: pnpm exec tsx scripts/juken-history-map-resolve-figures.ts <manifest.yml> [out.json]
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

type ManifestEntry = {
  name: string;
  wiki?: string;
  lang?: string;
  aliases?: string[];
  skip?: boolean;
};

type FigureRecord = {
  name: string;
  aliases?: string[];
  imageUrl: string;
  credit: string;
  license: string;
  sourceUrl: string;
  pageUrl?: string;
};

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function wikiThumb(title: string, lang: string): Promise<{
  thumb?: string;
  pageUrl?: string;
  imageTitle?: string;
}> {
  const api = `https://${lang}.wikipedia.org/w/api.php?` +
    new URLSearchParams({
      action: "query",
      titles: title,
      prop: "pageimages|pageterms",
      pithumbsize: "240",
      format: "json",
      origin: "*",
    });
  let res: Response | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    res = await fetch(api);
    if (res.status !== 429) break;
    await sleep(1500 * (attempt + 1));
  }
  if (!res?.ok) throw new Error(`wiki ${res?.status} ${title}`);
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { title?: string; thumbnail?: { source?: string }; pageimage?: string }> };
  };
  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page?.thumbnail?.source) return {};
  return {
    thumb: page.thumbnail.source,
    pageUrl: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    imageTitle: page.pageimage,
  };
}

async function commonsLicense(imageTitle: string): Promise<{ license: string; credit: string; fileUrl: string }> {
  const api =
    "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      titles: `File:${imageTitle}`,
      prop: "imageinfo",
      iiprop: "extmetadata|url",
      format: "json",
      origin: "*",
    });
  const res = await fetch(api);
  if (!res.ok) return { license: "See Wikimedia Commons", credit: imageTitle, fileUrl: "" };
  const data = (await res.json()) as {
    query?: {
      pages?: Record<string, { imageinfo?: { url?: string; extmetadata?: Record<string, { value?: string }> }[] }>;
    };
  };
  const info = Object.values(data.query?.pages ?? {})[0]?.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};
  const license = meta.LicenseShortName?.value ?? meta.License?.value ?? "See Wikimedia Commons";
  const artist = meta.Artist?.value?.replace(/<[^>]+>/g, "").trim();
  const credit = artist ? `${artist} / Wikimedia Commons` : `${imageTitle} / Wikimedia Commons`;
  const fileUrl =
    info?.url ??
    `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(imageTitle.replace(/ /g, "_"))}`;
  return { license, credit, fileUrl };
}

async function resolveEntry(entry: ManifestEntry): Promise<FigureRecord | null> {
  if (entry.skip) return null;
  const lang = entry.lang ?? "ja";
  const wikiTitle = entry.wiki ?? entry.name;
  const { thumb, pageUrl, imageTitle } = await wikiThumb(wikiTitle, lang);
  if (!thumb) {
    console.warn(`skip (no image): ${entry.name}`);
    return null;
  }
  let license = "See Wikimedia Commons";
  let credit = `${entry.name} / Wikimedia Commons`;
  let sourceUrl = pageUrl ?? thumb;
  if (imageTitle) {
    const commons = await commonsLicense(imageTitle);
    license = commons.license;
    credit = commons.credit;
    if (commons.fileUrl) sourceUrl = commons.fileUrl;
  }
  return {
    name: entry.name,
    aliases: entry.aliases,
    imageUrl: thumb,
    credit,
    license,
    sourceUrl,
    pageUrl,
  };
}

async function main() {
  const manifestPath = process.argv[2];
  const outPath =
    process.argv[3] ??
    path.join(path.dirname(manifestPath ?? "."), "figures.json");
  if (!manifestPath) {
    console.error("usage: tsx scripts/juken-history-map-resolve-figures.ts <manifest.yml> [out.json]");
    process.exit(1);
  }
  const manifest = yaml.load(fs.readFileSync(manifestPath, "utf8")) as { figures: ManifestEntry[] };
  const records: Record<string, FigureRecord> = {};
  for (const entry of manifest.figures) {
    await sleep(350);
    try {
      const rec = await resolveEntry(entry);
      if (rec) records[entry.name] = rec;
    } catch (err) {
      console.warn(`error: ${entry.name}`, err);
    }
  }
  fs.writeFileSync(outPath, `${JSON.stringify(records, null, 2)}\n`);
  console.log(`wrote ${Object.keys(records).length} figures → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});