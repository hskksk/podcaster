import { createSupabaseClient } from "../_shared/db.ts";
import { queueDelete, queueRead } from "../_shared/queue.ts";
import { loadConfig } from "../_shared/config.ts";
import { writeLog } from "../_shared/logger.ts";

Deno.serve(async (_req) => {
  EdgeRuntime.waitUntil(processQueue());
  return Response.json({ ok: true });
});

type EpisodeForRss = {
  id: string;
  title: string;
  description: string;
  mem_note_id: string | null;
  created_at: string;
  published_at: string | null;
  audio_files: Array<{ storage_path: string; mime_type: string }>;
  articles: { title: string } | null;
};

async function processQueue(): Promise<void> {
  const db = createSupabaseClient();
  const msg = await queueRead(db, "rss-queue");
  if (!msg) return;

  const episodeId = msg.message.episode_id as string;
  const startMs = Date.now();
  let memNoteId: string | null = null;

  try {
    const cfg = await loadConfig();

    const { data: episodes, error: fetchErr } = await db
      .from("episodes")
      .select("id, title, description, mem_note_id, created_at, published_at, audio_files(storage_path, mime_type), articles(title)")
      .in("status", ["audio_ready", "published", "rss_failed"])
      .order("created_at", { ascending: false });
    if (fetchErr) throw new Error(`Episodes fetch failed: ${fetchErr.message}`);

    const currentEp = (episodes as EpisodeForRss[]).find((ep) => ep.id === episodeId);
    memNoteId = currentEp?.mem_note_id ?? null;

    // PODCAST_PUBLIC_URL overrides the internal Docker URL in local dev
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const storageUrl = `${supabaseUrl}/storage/v1/object/public/podcast`;
    const xml = buildRssFeed(episodes as EpisodeForRss[], cfg, storageUrl);

    const encoder = new TextEncoder();
    const xmlBytes = encoder.encode(xml);
    const { error: uploadErr } = await db.storage
      .from("podcast")
      .upload("feed.xml", xmlBytes, {
        contentType: "text/xml",
        upsert: true,
        cacheControl: "60",
      });
    if (uploadErr) throw new Error(`feed.xml upload failed: ${uploadErr.message}`);

    await db
      .from("episodes")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", episodeId)
      .in("status", ["audio_ready", "rss_failed"]);

    await queueDelete(db, "rss-queue", msg.msg_id);
    await writeLog(db, {
      queue_name: "rss-queue",
      message_id: msg.msg_id,
      episode_id: episodeId,
      mem_note_id: memNoteId,
      status: "success",
      duration_ms: Date.now() - startMs,
    });
    console.log(`RSS updated, episode ${episodeId} published`);
  } catch (err) {
    console.error(`update-rss failed for episode ${episodeId}:`, err);
    await db
      .from("episodes")
      .update({ status: "rss_failed" })
      .eq("id", episodeId)
      .in("status", ["audio_ready", "rss_failed"]);
    await queueDelete(db, "rss-queue", msg.msg_id);
    await writeLog(db, {
      queue_name: "rss-queue",
      message_id: msg.msg_id,
      episode_id: episodeId,
      mem_note_id: memNoteId,
      status: "failure",
      error_message: String(err),
      duration_ms: Date.now() - startMs,
    });
  }
}

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

function buildRssFeed(
  episodes: EpisodeForRss[],
  cfg: Record<string, string>,
  storageUrl: string,
): string {
  const title = escapeXml(cfg["podcast.title"] || "My AI Podcast");
  const description = escapeXml(cfg["podcast.description"] || "");
  const coverUrl = escapeXml(cfg["podcast.cover_url"] || `${storageUrl}/cover.png`);
  const feedUrl = `${storageUrl}/feed.xml`;

  const items = episodes
    .filter((ep) => ep.audio_files?.some((af) => af.storage_path))
    .map((ep) => {
      const af = ep.audio_files.find((af) => af.storage_path)!;
      const audioUrl = `${storageUrl}/${af.storage_path}`;
      const articleTitle = ep.articles?.title ?? "";
      return `    <item>
      <title>${escapeXml(ep.title)}</title>
      <description>${escapeXml(ep.description)}</description>
      <pubDate>${toRfc2822(ep.published_at || ep.created_at)}</pubDate>
      <enclosure url="${escapeXml(audioUrl)}" length="0" type="${af.mime_type}" />
      <guid isPermaLink="false">${escapeXml(ep.id)}</guid>
      <podcaster:articleTitle><![CDATA[${articleTitle}]]></podcaster:articleTitle>
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
