import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  detectLocalStatus,
  detectProjectRef,
  detectServiceKey,
} from "../../lib/supabase-detect.js";
import * as Mock from "./mock.js";
import { Article, Episode, AudioFile, ProcessingLog, PodcastConfig, Script } from "./types.js";

dotenv.config({ path: ".env" });

export class DataClient {
  private db: SupabaseClient | null = null;
  private isMock: boolean;

  constructor(isMock: boolean = false) {
    this.isMock = isMock;
    if (!isMock) {
      const target = process.env.TARGET ?? "remote";
      let supabaseUrl: string;
      let serviceKey: string;

      if (target === "local") {
        const s = detectLocalStatus();
        supabaseUrl = s.apiUrl;
        serviceKey = s.serviceKey;
      } else {
        const ref = detectProjectRef();
        serviceKey = detectServiceKey(ref);
        supabaseUrl = `https://${ref}.supabase.co`;
      }
      this.db = createClient(supabaseUrl, serviceKey);
    }
  }

  async fetchAll() {
    if (this.isMock) {
      return {
        articles: Mock.ARTICLES,
        episodes: Mock.EPISODES,
        audioFiles: Mock.AUDIO_FILES,
        logs: Mock.LOGS,
        config: Mock.CONFIG,
        inbox: Mock.INBOX,
        draft: Mock.DRAFT,
      };
    }

    if (!this.db) throw new Error("DB not initialized");

    const [articles, episodes, audioFiles, logs, config, inboxFiles, articleFiles] = await Promise.all([
      this.db.from("articles").select("*").order("created_at", { ascending: false }),
      this.db.from("episodes").select("*").order("created_at", { ascending: false }),
      this.db.from("audio_files").select("*").order("created_at", { ascending: false }),
      this.db.from("processing_logs").select("*").order("processed_at", { ascending: false }).limit(50),
      this.db.from("podcast_config").select("*"),
      this.scanDir("inbox"),
      this.scanDir("articles"),
    ]);

    return {
      articles: articles.data as Article[] || [],
      episodes: episodes.data as Episode[] || [],
      audioFiles: audioFiles.data as AudioFile[] || [],
      logs: logs.data as ProcessingLog[] || [],
      config: config.data as PodcastConfig[] || [],
      inbox: inboxFiles,
      draft: articleFiles,
    };
  }

  private async scanDir(dir: string) {
    try {
      const files = await readdir(dir);
      return await Promise.all(
        files.filter(f => f.endsWith(".md")).map(async (f) => {
          const s = await stat(join(dir, f));
          return { name: f, size: s.size, mtime: s.mtime.toISOString() };
        })
      );
    } catch {
      return [];
    }
  }

  async fetchScript(episodeId: string): Promise<Script | null> {
    if (this.isMock) {
      return Mock.SCRIPTS.find(s => s.episode_id === episodeId) as any || null;
    }
    if (!this.db) return null;
    const { data } = await this.db.from("scripts").select("*").eq("episode_id", episodeId).maybeSingle();
    return data as Script | null;
  }

  async requeue(type: 'script' | 'audio' | 'rss', id: string) {
    if (this.isMock) {
      console.log(`Mock: Requeued ${type} for ${id}`);
      return { success: true };
    }
    if (!this.db) return { success: false };

    const queueName = type === 'script' ? 'script-queue' : type === 'audio' ? 'audio-queue' : 'rss-queue';
    const msg = type === 'script' ? { article_id: id } : { episode_id: id };

    const { error } = await this.db.rpc("pgmq_send", { queue_name: queueName, msg });
    return { success: !error, error };
  }
}
