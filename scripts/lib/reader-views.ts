import type { SupabaseClient } from "@supabase/supabase-js";

/** Phase 5 read models in the podcast schema. */
export function podcastReaders(db: SupabaseClient) {
  return db.schema("podcast");
}

/** Phase 5 job execution log (legacy processing_logs + job_attempts). */
export function jobReaders(db: SupabaseClient) {
  return db.schema("jobs");
}
