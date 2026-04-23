import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { QueueMessage } from "./types.ts";

const VISIBILITY_TIMEOUT_SEC = 300; // 5 minutes

export async function queueRead(
  db: SupabaseClient,
  queueName: string,
): Promise<QueueMessage | null> {
  const { data, error } = await db.rpc("pgmq_read", {
    queue_name: queueName,
    vt: VISIBILITY_TIMEOUT_SEC,
    qty: 1,
  });
  if (error) throw new Error(`Queue read failed: ${error.message}`);
  return data?.[0] ?? null;
}

export async function queueSend(
  db: SupabaseClient,
  queueName: string,
  message: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.rpc("pgmq_send", {
    queue_name: queueName,
    msg: message,
  });
  if (error) throw new Error(`Queue send failed: ${error.message}`);
}

export async function queueDelete(
  db: SupabaseClient,
  queueName: string,
  msgId: bigint,
): Promise<void> {
  const { error } = await db.rpc("pgmq_delete", {
    queue_name: queueName,
    msg_id: msgId,
  });
  if (error) throw new Error(`Queue delete failed: ${error.message}`);
}
