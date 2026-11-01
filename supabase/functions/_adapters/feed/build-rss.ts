export type FeedEpisodeItem = {
  guid: string;
  title: string;
  description: string;
  pubDateIso: string;
  audioStoragePath: string;
  audioMimeType: string;
  audioByteSize: number;
  imageStoragePath: string | null;
  articleTitle: string;
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toRfc2822(iso: string): string {
  return new Date(iso).toUTCString();
}

export function buildRssFeedXml(
  episodes: FeedEpisodeItem[],
  cfg: Record<string, string>,
  storageUrl: string,
): string {
  const title = escapeXml(cfg["podcast.title"] || "My AI Podcast");
  const description = escapeXml(cfg["podcast.description"] || "");
  const coverUrl = escapeXml(cfg["podcast.cover_url"] || `${storageUrl}/cover.png`);
  const feedUrl = `${storageUrl}/feed.xml`;

  const items = episodes
    .filter((ep) => ep.audioStoragePath)
    .map((ep) => {
      const audioUrl = `${storageUrl}/${ep.audioStoragePath.replace(/^\//, "")}`;
      const episodeImageUrl = ep.imageStoragePath
        ? (ep.imageStoragePath.startsWith("http")
          ? ep.imageStoragePath
          : `${storageUrl}/${ep.imageStoragePath.replace(/^\//, "")}`)
        : "";
      const itunesImageLine = episodeImageUrl
        ? `\n      <itunes:image href="${escapeXml(episodeImageUrl)}" />`
        : "";
      return `    <item>
      <title>${escapeXml(ep.title)}</title>
      <description>${escapeXml(ep.description)}</description>
      <pubDate>${toRfc2822(ep.pubDateIso)}</pubDate>
      <enclosure url="${escapeXml(audioUrl)}" length="${ep.audioByteSize}" type="${ep.audioMimeType}" />${itunesImageLine}
      <guid isPermaLink="false">${escapeXml(ep.guid)}</guid>
      <podcaster:articleTitle><![CDATA[${ep.articleTitle}]]></podcaster:articleTitle>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:podcaster="https://github.com/hskksk/podcaster">
  <channel>
    <title>${title}</title>
    <link>${feedUrl}</link>
    <description>${description}</description>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <image>
      <url>${coverUrl}</url>
      <title>${title}</title>
      <link>${feedUrl}</link>
    </image>
    <itunes:image href="${coverUrl}" />
${items}
  </channel>
</rss>`;
}
