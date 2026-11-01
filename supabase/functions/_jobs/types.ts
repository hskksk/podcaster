export type JobTypeName = "write_script" | "render_audio" | "paint_artwork";

export type JobStatus =
  | "requested"
  | "running"
  | "waiting_external"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AttemptOutcome = "succeeded" | "retryable" | "terminal" | "rate_limited";

export interface JobRow {
  id: string;
  job_type: JobTypeName;
  correlation_id: string | null;
  requested_by_event_id: string | null;
  idempotency_key: string;
  input: Record<string, unknown>;
  status: JobStatus;
  output: Record<string, unknown> | null;
  requested_at: string;
  finished_at: string | null;
}

export interface JobRunResult {
  outcome: AttemptOutcome;
  output?: Record<string, unknown>;
  /** Batch submitted; job stays waiting_external until poller resumes. */
  waitingExternal?: boolean;
  errorMessage?: string;
}

export interface WriteScriptInput {
  article_content: string;
  profile?: Record<string, unknown>;
}

export interface RenderAudioInput {
  script_id: string;
  script_content: string;
  profile?: Record<string, unknown>;
  /** Resume after batch completes (set by poller). */
  resume?: boolean;
}

export interface PaintArtworkInput {
  script_id: string;
  title: string;
  description: string;
  article_excerpt?: string;
  profile?: Record<string, unknown>;
}

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface JobHandlerContext {
  db: SupabaseClient;
  job: JobRow;
  attemptId: string;
  attemptNo: number;
}

export type JobHandler = (ctx: JobHandlerContext) => Promise<JobRunResult>;
