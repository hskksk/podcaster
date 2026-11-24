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
  /** Wikimedia Commons file name (with or without File: prefix). Skips pageimage heuristics. */
  file?: string;
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

const PORTRAIT_REJECT =
  /(?:^|[_\s.-])(kaou|kao|kaku|inpo|inko)|花押|署名|印章|family[\s_-]?crest|coat[\s_-]?of[\s_-]?arms|mon[\s_-]?\(|\bmon\b[\s_-]?emblem/i;
const PORTRAIT_PREFER =
  /portrait|肖像|bust|half[\s_-]?length|画像|絵像|porträt|retrato|photo|photograph|写真|塑像|彫像|possible image of|head of|likeness/i;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/** Strip Wikimedia extmetadata HTML for plain-text credits (CodeQL-safe). */
function stripHtmlMetadata(raw: string): string {
  let text = raw;
  let prev = "";
  while (text !== prev) {
    prev = text;
    text = text.replace(/<[^>]*>/g, "");
  }
  return text.replace(/[<>]/g, "").trim();
}

export function isLikelyNonPortraitFileName(fileTitle: string): boolean {
  const base = fileTitle.replace(/^File:/i, "");
  return PORTRAIT_REJECT.test(base);
}

function portraitScore(fileTitle: string): number {
  const base = fileTitle.replace(/^File:/i, "");
  if (isLikelyNonPortraitFileName(base)) return -1000;
  let score = 0;
  if (PORTRAIT_PREFER.test(base)) score += 40;
  if (/\.(jpg|jpeg|png|webp)$/i.test(base)) score += 5;
  if (/\.svg$/i.test(base)) score -= 15;
  if (/map|地図|flag|旗|banner|紋章|emblem|logo|hanami|花見/i.test(base)) score -= 30;
  if (/signature|signatur|inscription|落款/i.test(base)) score -= 80;
  return score;
}

async function wikiQuery<T>(lang: string, params: Record<string, string>): Promise<T> {
  const api = `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({ format: "json", origin: "*", ...params });
  let res: Response | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    res = await fetch(api);
    if (res.status !== 429) break;
    await sleep(1500 * (attempt + 1));
  }
  if (res?.status === 429) {
    await sleep(4000);
    throw new Error("wiki 429");
  }
  if (!res?.ok) throw new Error(`wiki ${res?.status}`);
  return (await res.json()) as T;
}

async function commonsQuery<T>(params: Record<string, string>): Promise<T> {
  const api = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ format: "json", origin: "*", ...params });
  const res = await fetch(api);
  if (!res.ok) throw new Error(`commons ${res.status}`);
  return (await res.json()) as T;
}

function normalizeWikiFileTitle(fileTitle: string): string {
  const t = fileTitle.trim();
  if (/^file:/i.test(t)) return `File:${t.replace(/^file:/i, "")}`;
  if (t.startsWith("ファイル:")) return `File:${t.slice("ファイル:".length)}`;
  return `File:${t}`;
}

function fileTitleBase(fileTitle: string): string {
  return normalizeWikiFileTitle(fileTitle).replace(/^File:/i, "");
}

async function thumbForFile(fileTitle: string, thumbSize = 240): Promise<{ thumb?: string; imageTitle?: string }> {
  const title = normalizeWikiFileTitle(fileTitle);
  const data = await commonsQuery<{
    query?: { pages?: Record<string, { title?: string; imageinfo?: { thumburl?: string; url?: string }[] }> };
  }>({
    action: "query",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|thumburl",
    iiurlwidth: String(thumbSize),
  });
  const page = Object.values(data.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info?.thumburl && !info?.url) return {};
  return {
    thumb: info.thumburl ?? info.url,
    imageTitle: page?.title?.replace(/^File:/, "") ?? fileTitle.replace(/^File:/, ""),
  };
}

async function listPageImages(wikiTitle: string, lang: string): Promise<string[]> {
  const data = await wikiQuery<{
    query?: { pages?: Record<string, { images?: { title: string }[] }> };
  }>(lang, {
    action: "query",
    titles: wikiTitle,
    prop: "images",
    imlimit: "max",
  });
  const page = Object.values(data.query?.pages ?? {})[0];
  return (page?.images ?? [])
    .map((img) => img.title)
    .filter((t) => /^file:/i.test(t) || t.startsWith("ファイル:"));
}

async function wikiPageThumb(wikiTitle: string, lang: string): Promise<{
  thumb?: string;
  pageUrl?: string;
  imageTitle?: string;
}> {
  const data = await wikiQuery<{
    query?: { pages?: Record<string, { title?: string; thumbnail?: { source?: string }; pageimage?: string }> };
  }>(lang, {
    action: "query",
    titles: wikiTitle,
    prop: "pageimages",
    pithumbsize: "240",
  });
  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page?.thumbnail?.source) return {};
  return {
    thumb: page.thumbnail.source,
    pageUrl: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, "_"))}`,
    imageTitle: page.pageimage,
  };
}

async function pickPortraitImage(
  wikiTitle: string,
  lang: string,
  explicitFile?: string,
): Promise<{ thumb?: string; pageUrl?: string; imageTitle?: string }> {
  const pageUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, "_"))}`;

  if (explicitFile) {
    const fromFile = await thumbForFile(explicitFile);
    if (fromFile.thumb) {
      return { ...fromFile, pageUrl };
    }
  }

  const pageThumb = await wikiPageThumb(wikiTitle, lang);
  if (pageThumb.imageTitle && !isLikelyNonPortraitFileName(pageThumb.imageTitle) && pageThumb.thumb) {
    return pageThumb;
  }

  const candidates = (await listPageImages(wikiTitle, lang))
    .map((title) => ({ title: fileTitleBase(title), score: portraitScore(fileTitleBase(title)) }))
    .filter((c) => c.score > -500)
    .sort((a, b) => b.score - a.score);

  for (const candidate of candidates) {
    const resolved = await thumbForFile(candidate.title);
    if (!resolved.thumb || !resolved.imageTitle) continue;
    if (isLikelyNonPortraitFileName(resolved.imageTitle)) continue;
    return { thumb: resolved.thumb, imageTitle: resolved.imageTitle, pageUrl };
  }

  if (pageThumb.thumb && pageThumb.imageTitle) {
    console.warn(`fallback pageimage: ${wikiTitle} → ${pageThumb.imageTitle}`);
    return pageThumb;
  }

  return { pageUrl };
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
  const artist = meta.Artist?.value ? stripHtmlMetadata(meta.Artist.value) : "";
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
  const { thumb, pageUrl, imageTitle } = await pickPortraitImage(wikiTitle, lang, entry.file);
  if (!thumb) {
    console.warn(`skip (no image): ${entry.name}`);
    return null;
  }
  if (imageTitle && isLikelyNonPortraitFileName(imageTitle)) {
    console.warn(`skip (non-portrait): ${entry.name} → ${imageTitle}`);
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
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const rec = await resolveEntry(entry);
        if (rec) records[entry.name] = rec;
        break;
      } catch (err) {
        if (attempt < 2 && String(err).includes("429")) {
          await sleep(5000 * (attempt + 1));
          continue;
        }
        console.warn(`error: ${entry.name}`, err);
        break;
      }
    }
  }
  fs.writeFileSync(outPath, `${JSON.stringify(records, null, 2)}\n`);
  console.log(`wrote ${Object.keys(records).length} figures → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});