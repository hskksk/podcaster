export interface Article {
  id: string;
  title: string;
  content: string;
  source_url?: string;
  source?: string;
  mem_note_id?: string;
  created_at: string;
}

export interface Episode {
  id: string;
  article_id?: string;
  mem_note_id?: string;
  title: string;
  description: string;
  status: "script_ready" | "audio_ready" | "published" | "failed";
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
  "tts.host.name": string;
  "tts.host.voice": string;
  "tts.cohost.name": string;
  "tts.cohost.voice": string;
  "generator.model": string;
}

export interface QueueMessage {
  msg_id: bigint;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: Record<string, unknown>;
}
