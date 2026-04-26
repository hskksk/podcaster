import { createSupabaseClient } from "../_shared/db.ts";
import { queueDelete, queueRead } from "../_shared/queue.ts";
import { loadConfig } from "../_shared/config.ts";
import type { Episode } from "../_shared/types.ts";
import { writeLog } from "../_shared/logger.ts";

Deno.serve(async (_req) => {
  EdgeRuntime.waitUntil(processQueue());
  return Response.json({ ok: true });
});

async function processQueue(): Promise<void> {
  const db = createSupabaseClient();
  const msg = await queueRead(db, "rss-queue");
  if (!msg) return;

  const episodeId = msg.message.episode_id as string;
  const startMs = Date.now();

  try {
    const cfg = await loadConfig();

    const { data: episodes, error: fetchErr } = await db
      .from("episodes")
      .select("id, title, description, audio_path, created_at, published_at")
      .in("status", ["audio_ready", "published"])
      .order("created_at", { ascending: false });
    if (fetchErr) throw new Error(`Episodes fetch failed: ${fetchErr.message}`);

    // PODCAST_PUBLIC_URL overrides the internal Docker URL in local dev
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const storageUrl = `${supabaseUrl}/storage/v1/object/public/podcast`;
    const xml = buildRssFeed(episodes as Episode[], cfg, storageUrl);

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
      .in("status", ["audio_ready"]);

    await queueDelete(db, "rss-queue", msg.msg_id);
    await writeLog(db, {
      queue_name: "rss-queue",
      message_id: msg.msg_id,
      episode_id: episodeId,
      status: "success",
      duration_ms: Date.now() - startMs,
    });
    console.log(`RSS updated, episode ${episodeId} published`);
  } catch (err) {
    console.error(`update-rss failed for episode ${episodeId}:`, err);
    await queueDelete(db, "rss-queue", msg.msg_id);
    await writeLog(db, {
      queue_name: "rss-queue",
      message_id: msg.msg_id,
      episode_id: episodeId,
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
  episodes: Episode[],
  cfg: Record<string, string>,
  storageUrl: string,
): string {
  const title = escapeXml(cfg["podcast.title"] || "My AI Podcast");
  const description = escapeXml(cfg["podcast.description"] || "");
  const coverUrl = escapeXml(cfg["podcast.cover_url"] || `${storageUrl}/cover.png`);
  const feedUrl = `${storageUrl}/feed.xml`;

  const items = episodes
    .filter((ep) => ep.audio_path)
    .map((ep) => {
      const audioUrl = `${storageUrl}/${ep.audio_path}`;
      const ext = ep.audio_path!.split(".").pop()?.toLowerCase();
      const mimeType = ext === "m4a" ? "audio/mp4"
        : ext === "mp3" ? "audio/mpeg"
        : "audio/wav";
      return `    <item>
      <title>${escapeXml(ep.title)}</title>
      <description>${escapeXml(ep.description)}</description>
      <pubDate>${toRfc2822(ep.published_at || ep.created_at)}</pubDate>
      <enclosure url="${escapeXml(audioUrl)}" length="0" type="${mimeType}" />
      <guid isPermaLink="false">${escapeXml(ep.id)}</guid>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:atom="http://www.w3.org/2005/Atom">
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
