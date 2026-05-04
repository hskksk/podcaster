export interface Article {
  id: string;
  mem_note_id: string | null;
  title: string;
  content: string;
  source: string;
  created_at: string;
}

export interface Episode {
  id: string;
  article_id: string | null;
  mem_note_id: string | null;
  title: string;
  status: string;
  created_at: string;
}

export interface LlmUsage {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  [key: string]: unknown;
}

export interface Script {
  id: string;
  episode_id: string;
  content: string;
  status: string;
  error: string | null;
  llm_usage?: LlmUsage | null;
  llm_response?: Record<string, unknown> | null;
  created_at: string;
}

export interface AudioFile {
  id: string;
  episode_id: string;
  storage_path: string;
  mime_type: string;
  status: string;
  error: string | null;
  llm_usage?: LlmUsage | null;
  llm_response?: Record<string, unknown> | null;
  created_at: string;
}

export interface ProcessingLog {
  processed_at: string;
  queue_name: string;
  status: string;
  episode_id: string | null;
  article_id: string | null;
  duration_ms: number | null;
  error_message: string | null;
}

export interface PodcastConfig {
  key: string;
  value: any;
}

export interface InboxFile {
  name: string;
  size: number;
  mtime: string;
  status?: string;
}
