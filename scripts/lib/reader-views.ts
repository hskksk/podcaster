import type { SupabaseClient } from "@supabase/supabase-js";

/** Phase 5 read models in the podcast schema. */
export function podcastReaders(db: SupabaseClient) {
  return db.schema("podcast");
}

/** Job execution log (`jobs.attempt_log` view over job_attempts). */
export function jobReaders(db: SupabaseClient) {
  return db.schema("jobs");
}
