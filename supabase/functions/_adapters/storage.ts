import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface StoredBlob {
  blobId: string;
  storagePath: string;
  mimeType: string;
  byteSize: number;
}

/** Write bytes to Storage and register podcast.blobs (content-addressed under job id). */
export async function storeBlob(
  db: SupabaseClient,
  opts: {
    jobId: string;
    attemptId: string;
    bytes: Uint8Array | ReadableStream<Uint8Array>;
    mimeType: string;
    fileName: string;
  },
): Promise<StoredBlob> {
  const storagePath = `jobs/${opts.jobId}/${opts.attemptId}/${opts.fileName}`;
  const body = opts.bytes instanceof Uint8Array ? opts.bytes : opts.bytes;

  const { error: uploadErr } = await db.storage.from("podcast").upload(storagePath, body, {
    contentType: opts.mimeType,
    upsert: true,
    cacheControl: "31536000",
  });
  if (uploadErr) throw new Error(`storeBlob upload: ${uploadErr.message}`);

  const byteSize = opts.bytes instanceof Uint8Array
    ? opts.bytes.byteLength
    : 0;

  const blobId = crypto.randomUUID();
  const { error: blobErr } = await db.schema("podcast").from("blobs").insert({
    id: blobId,
    storage_path: storagePath,
    mime_type: opts.mimeType,
    byte_size: byteSize,
    produced_by_attempt_id: opts.attemptId,
  });
  if (blobErr) throw new Error(`storeBlob insert: ${blobErr.message}`);

  return { blobId, storagePath, mimeType: opts.mimeType, byteSize };
}

/** Register a delivery blob at an explicit storage path (e.g. audio/{episodeId}.m4a). */
export async function registerDeliveryBlob(
  db: SupabaseClient,
  opts: {
    attemptId: string;
    storagePath: string;
    mimeType: string;
    byteSize: number;
    durationMs?: number | null;
  },
): Promise<StoredBlob> {
  const blobId = crypto.randomUUID();
  const { error: blobErr } = await db.schema("podcast").from("blobs").insert({
    id: blobId,
    storage_path: opts.storagePath,
    mime_type: opts.mimeType,
    byte_size: opts.byteSize,
    produced_by_attempt_id: opts.attemptId,
  });
  if (blobErr) throw new Error(`registerDeliveryBlob insert: ${blobErr.message}`);
  void opts.durationMs;
  return {
    blobId,
    storagePath: opts.storagePath,
    mimeType: opts.mimeType,
    byteSize: opts.byteSize,
  };
}

export async function deleteBlobById(
  db: SupabaseClient,
  blobId: string,
): Promise<void> {
  const { data, error } = await db
    .schema("podcast")
    .from("blobs")
    .select("storage_path")
    .eq("id", blobId)
    .maybeSingle();
  if (error) throw new Error(`deleteBlobById load: ${error.message}`);
  if (!data?.storage_path) return;

  const storagePath = data.storage_path as string;
  const { error: storageErr } = await db.storage.from("podcast").remove([storagePath]);
  if (storageErr) throw new Error(`deleteBlobById storage: ${storageErr.message}`);

  const { error: delErr } = await db.schema("podcast").from("blobs").delete().eq("id", blobId);
  if (delErr) throw new Error(`deleteBlobById row: ${delErr.message}`);
}
