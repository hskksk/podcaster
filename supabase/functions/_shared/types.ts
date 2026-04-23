export interface Article {
  id: string;
  title: string;
  content: string;
  source_url?: string;
  source?: string;
  created_at: string;
}

export interface Episode {
  id: string;
  article_id?: string;
  title: string;
  description: string;
  script: string;
  audio_path?: string;
  status: "script_ready" | "audio_ready" | "published" | "failed";
  error?: string;
  created_at: string;
  published_at?: string;
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
