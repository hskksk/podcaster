import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface LogEntry {
  queue_name: string;
  message_id?: bigint | null;
  episode_id?: string | null;
  article_id?: string | null;
  status: "success" | "failure";
  error_message?: string | null;
  duration_ms?: number | null;
}

export async function writeLog(db: SupabaseClient, entry: LogEntry): Promise<void> {
  const { error } = await db.from("processing_logs").insert({
    ...entry,
    message_id: entry.message_id ? Number(entry.message_id) : null,
  });
  if (error) {
    console.error("Failed to write processing log:", error.message);
  }
}
