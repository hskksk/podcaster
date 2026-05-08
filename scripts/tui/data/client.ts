import { mkdir, mkdtemp, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { tmpdir } from "node:os";
import dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  detectLocalStatus,
  detectProjectRef,
  detectServiceKey,
} from "../../lib/supabase-detect.js";
import { createMemNoteFromFile } from "../../lib/create-mem-note-from-file.js";
import * as Mock from "./mock.js";
import { Article, Episode, AudioFile, ProcessingLog, PodcastConfig, Script } from "./types.js";

dotenv.config({ path: ".env" });

export type ClientActionResult = {
  success: boolean;
  /** Human-readable error or API body text */
  error?: string;
  /** Local path when download/play wrote a file */
  path?: string;
};

type RequeueOptions = {
  regenerate?: boolean;
};

export class DataClient {
  private db: SupabaseClient | null = null;
  private isMock: boolean;
  private apiUrl: string | null = null;
  private serviceKey: string | null = null;
  private playProcess: ChildProcess | null = null;

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
      this.apiUrl = supabaseUrl;
      this.serviceKey = serviceKey;
      this.db = createClient(supabaseUrl, serviceKey);
    }
  }

  /** Stop afplay / other player started by playAudio (no-op in mock). */
  stopPlayback(): void {
    if (this.playProcess) {
      this.playProcess.kill("SIGTERM");
      this.playProcess = null;
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

  async requeue(
    type: "script" | "audio" | "rss",
    id: string,
    options?: RequeueOptions,
  ): Promise<ClientActionResult> {
    if (this.isMock) {
      console.log(`Mock: Requeued ${type} for ${id}`);
      return { success: true };
    }
    if (!this.db) return { success: false, error: "DB not initialized" };

    const msg: Record<string, unknown> = {
      episode_id: id,
      start_from: type,
      trigger: "manual",
    };
    if (options?.regenerate) msg.regenerate = true;

    const { error } = await this.db
      .schema("pgflow")
      .rpc("start_flow", { flow_slug: "episode_pipeline_v1", input: msg });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  /** POST /functions/v1/ingest with mem_note_id (same contract as scripts/ingest.ts). */
  async ingestMemNote(memNoteId: string): Promise<ClientActionResult> {
    const trimmed = memNoteId.trim();
    if (!trimmed) return { success: false, error: "mem_note_id is empty" };
    if (this.isMock) {
      console.log(`Mock: ingest ${trimmed}`);
      return { success: true };
    }
    if (!this.apiUrl || !this.serviceKey) return { success: false, error: "API not configured" };
    const ingestUrl = `${this.apiUrl}/functions/v1/ingest`;
    const res = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.serviceKey}`,
      },
      body: JSON.stringify({ mem_note_id: trimmed }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { success: false, error: text || `HTTP ${res.status}` };
    }
    return { success: true };
  }

  /**
   * Inbox TUI shortcut: register `./inbox/<file>` or `./articles/<file>` in mem.ai (pnpm mem-ai),
   * then POST ingest with the returned mem_note_id (same flow as scripts/ingest.ts file mode).
   */
  async ingestMarkdownFile(fileName: string, pane: "inbox" | "draft"): Promise<ClientActionResult> {
    const subdir = pane === "inbox" ? "inbox" : "articles";
    const resolved = join(process.cwd(), subdir, fileName);
    if (this.isMock) {
      console.log(`Mock: ingest markdown file ${resolved}`);
      return { success: true };
    }
    if (!existsSync(resolved)) {
      return { success: false, error: `File not found: ${resolved}` };
    }
    try {
      const memNoteId = createMemNoteFromFile(resolved, []);
      return await this.ingestMemNote(memNoteId);
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  /** Download podcast audio to ./downloads (audio_files.id or episode_id). */
  async downloadAudio(idOrEpisodeId: string): Promise<ClientActionResult> {
    if (this.isMock) {
      console.log(`Mock: download audio ${idOrEpisodeId}`);
      return { success: true, path: join(process.cwd(), "downloads", "mock-audio.wav") };
    }
    const row = await this.lookupAudioRow(idOrEpisodeId);
    if (!row) return { success: false, error: "No audio file for id/episode" };
    if (!this.db) return { success: false, error: "DB not initialized" };

    const storagePath = row.storage_path;
    const filename = storagePath.split("/").pop() ?? `${row.id}.audio`;

    const { data: blob, error: dlErr } = await this.db.storage.from("podcast").download(storagePath);
    if (dlErr || !blob) {
      return { success: false, error: dlErr?.message ?? "Download failed" };
    }
    const destDir = join(process.cwd(), "downloads");
    await mkdir(destDir, { recursive: true });
    const dest = join(destDir, filename);
    await writeFile(dest, Buffer.from(await blob.arrayBuffer()));
    return { success: true, path: dest };
  }

  /**
   * Download to a temp file and play with afplay (macOS). Call stopPlayback() to stop.
   * Mock: no playback, returns success.
   */
  async fetchAudioDurationSeconds(idOrEpisodeId: string): Promise<number | null> {
    if (this.isMock) return null;
    if (process.platform !== "darwin") return null;

    const row = await this.lookupAudioRow(idOrEpisodeId);
    if (!row || !this.db) return null;

    const { data: blob, error: dlErr } = await this.db.storage.from("podcast").download(row.storage_path);
    if (dlErr || !blob) return null;

    const dir = await mkdtemp(join(tmpdir(), "podcaster-audio-"));
    const path = join(dir, "probe.audio");
    await writeFile(path, Buffer.from(await blob.arrayBuffer()));

    return await this.probeAudioDurationWithAfinfo(path);
  }

  async playAudio(idOrEpisodeId: string): Promise<ClientActionResult> {
    if (this.isMock) {
      console.log(`Mock: play audio ${idOrEpisodeId}`);
      return { success: true };
    }
    if (process.platform !== "darwin") {
      return { success: false, error: "playAudio is only supported on macOS (afplay)" };
    }
    const row = await this.lookupAudioRow(idOrEpisodeId);
    if (!row) return { success: false, error: "No audio file for id/episode" };
    if (!this.db) return { success: false, error: "DB not initialized" };

    const { data: blob, error: dlErr } = await this.db.storage.from("podcast").download(row.storage_path);
    if (dlErr || !blob) {
      return { success: false, error: dlErr?.message ?? "Download failed" };
    }
    const dir = await mkdtemp(join(tmpdir(), "podcaster-audio-"));
    const path = join(dir, "play.wav");
    await writeFile(path, Buffer.from(await blob.arrayBuffer()));

    this.stopPlayback();
    this.playProcess = spawn("afplay", [path], { stdio: "ignore" });
    this.playProcess.on("error", () => {
      this.playProcess = null;
    });
    this.playProcess.on("close", () => {
      this.playProcess = null;
    });
    return { success: true, path };
  }

  private async probeAudioDurationWithAfinfo(path: string): Promise<number | null> {
    return await new Promise(resolve => {
      const p = spawn("afinfo", [path]);
      let output = "";

      p.stdout.on("data", chunk => {
        output += String(chunk);
      });
      p.stderr.on("data", chunk => {
        output += String(chunk);
      });

      p.on("error", () => resolve(null));
      p.on("close", code => {
        if (code !== 0) {
          resolve(null);
          return;
        }
        const match = output.match(/estimated duration:\s*([0-9]+(?:\.[0-9]+)?)\s*sec/i);
        if (!match) {
          resolve(null);
          return;
        }
        resolve(Number.parseFloat(match[1]));
      });
    });
  }

  private async lookupAudioRow(
    idOrEpisodeId: string
  ): Promise<{ id: string; storage_path: string } | null> {
    if (!this.db) return null;
    const { data, error } = await this.db
      .from("audio_files")
      .select("id, storage_path")
      .or(`id.eq.${idOrEpisodeId},episode_id.eq.${idOrEpisodeId}`)
      .maybeSingle();
    if (error || !data) return null;
    return data as { id: string; storage_path: string };
  }
}
