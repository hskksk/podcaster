/** Domain event names (append-only log). */

export type DomainEventType =
  | "ShowConfigured"
  | "ArticleRegistered"
  | "EpisodeOpened"
  | "ProductionRequested"
  | "ScriptWritten"
  | "AudioRendered"
  | "ArtworkPainted"
  | "EpisodeAssembled"
  | "EpisodePublished"
  | "EpisodeWithdrawn"
  | "FeedRebuilt"
  | "ProductionFailed";

export type StreamType =
  | "show"
  | "article"
  | "episode"
  | "production";

export interface EventEnvelope<T extends DomainEventType = DomainEventType> {
  id?: string;
  position?: number;
  type: T;
  stream_type: StreamType;
  stream_id: string;
  stream_version: number;
  occurred_at: string;
  actor: string;
  correlation_id?: string | null;
  causation_id?: string | null;
  payload: DomainEventPayload[T];
}

export interface ShowConfiguredPayload {
  show_id: string;
  title: string;
  description: string;
  cover_blob_id: string | null;
  publication_policy: "auto" | "manual";
}

export interface ArticleRegisteredPayload {
  article_id: string;
  article_revision_id: string;
  content_path: string | null;
  content_sha: string;
  title: string;
  content: string;
  ingest_route: string | null;
  mem_note_id?: string | null;
}

export interface EpisodeOpenedPayload {
  episode_id: string;
  article_id: string;
  show_id: string;
  guid: string;
}

export interface ProductionProfile {
  generator: Record<string, unknown>;
  tts: Record<string, unknown>;
  image: Record<string, unknown>;
  gemini?: Record<string, unknown>;
}

export interface ProductionRequestedPayload {
  production_id: string;
  episode_id: string;
  article_revision_id: string;
  base_revision_id: string | null;
  scope: "full" | "audio" | "artwork";
  trigger: "ingest" | "manual" | "migration";
  profile: ProductionProfile;
}

export interface ScriptWrittenPayload {
  script_id: string;
  job_id: string | null;
  title: string;
  description: string;
  content: string;
}

export interface AudioRenderedPayload {
  audio_id: string;
  job_id: string | null;
  script_id: string;
  blob_id: string;
  duration_ms: number;
  casting: Record<string, unknown>;
}

export interface ArtworkPaintedPayload {
  artwork_id: string;
  job_id: string | null;
  script_id: string;
  blob_id: string;
}

export interface EpisodeAssembledPayload {
  episode_revision_id: string;
  script_id: string;
  audio_id: string;
  artwork_id: string | null;
  title: string;
  description: string;
}

export interface EpisodePublishedPayload {
  publication_id: string;
  episode_revision_id: string;
  superseded_publication_id: string | null;
}

export interface EpisodeWithdrawnPayload {
  publication_id: string;
  reason: string;
}

export interface FeedRebuiltItem {
  episode_revision_id: string;
  guid: string;
  pub_date: string;
}

export interface FeedRebuiltPayload {
  feed_snapshot_id: string;
  blob_id: string;
  items: FeedRebuiltItem[];
}

export interface ProductionFailedPayload {
  production_id: string;
  failed_job_id: string | null;
  reason: string;
}

export interface DomainEventPayload {
  ShowConfigured: ShowConfiguredPayload;
  ArticleRegistered: ArticleRegisteredPayload;
  EpisodeOpened: EpisodeOpenedPayload;
  ProductionRequested: ProductionRequestedPayload;
  ScriptWritten: ScriptWrittenPayload;
  AudioRendered: AudioRenderedPayload;
  ArtworkPainted: ArtworkPaintedPayload;
  EpisodeAssembled: EpisodeAssembledPayload;
  EpisodePublished: EpisodePublishedPayload;
  EpisodeWithdrawn: EpisodeWithdrawnPayload;
  FeedRebuilt: FeedRebuiltPayload;
  ProductionFailed: ProductionFailedPayload;
}

export type DomainEvent = {
  [K in DomainEventType]: EventEnvelope<K>;
}[DomainEventType];

export type NewDomainEvent = Omit<EventEnvelope, "id" | "position"> & {
  id?: string;
};

/** Single show for this deployment (backfill / legacy). */
export const DEFAULT_SHOW_ID = "00000000-0000-4000-8000-000000000001";
