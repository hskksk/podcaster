export interface Article {
  id: string;
  title: string;
  content: string;
  source_url?: string;
  source?: string;
  mem_note_id?: string;
  ingest_route?: string;
  ingest_meta?: Record<string, unknown>;
  created_at: string;
}

export interface Episode {
  id: string;
  article_id?: string;
  mem_note_id?: string;
  title: string;
  description: string;
  status:
    | "ingested"
    | "script_running"
    | "script_ready"
    | "script_failed"
    | "audio_running"
    | "audio_ready"
    | "audio_failed"
    | "published"
    | "rss_failed";
  created_at: string;
  published_at?: string;
}

export interface Script {
  id: string;
  episode_id: string;
  content: string;
  status: "pending" | "ready" | "failed";
  error?: string;
  created_at: string;
}

export interface AudioFile {
  id: string;
  episode_id: string;
  script_id?: string;
  storage_path: string;
  mime_type: string;
  status: "pending" | "ready" | "failed";
  error?: string;
  created_at: string;
}

export interface PodcastConfigMap {
  "podcast.title": string;
  "podcast.description": string;
  "podcast.cover_url": string;
  "tts.model": string;
  "tts.instructions": string;
  "tts.selection_mode": "fixed" | "random";
  "tts.host.name": string;
  "tts.host.voice": string;
  "tts.host.tone": string;
  "tts.host.voice_options": string[];
  "tts.host.tone_options": string[];
  "tts.cohost.name": string;
  "tts.cohost.voice": string;
  "tts.cohost.tone": string;
  "tts.cohost.voice_options": string[];
  "tts.cohost.tone_options": string[];
  "generator.model": string;
  "gemini.api_endpoint"?: string;
}
