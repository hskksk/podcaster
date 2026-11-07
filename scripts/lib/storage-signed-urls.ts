import type { SupabaseClient } from "@supabase/supabase-js";

const SIGNED_URL_TTL_SEC = 1800;

export async function createSignedDownloadUrl(
  db: SupabaseClient,
  storagePath: string,
): Promise<string> {
  const { data, error } = await db.storage.from("podcast").createSignedUrl(
    storagePath,
    SIGNED_URL_TTL_SEC,
  );
  if (error || !data?.signedUrl) {
    throw new Error(`createSignedDownloadUrl: ${error?.message ?? "missing signedUrl"}`);
  }
  return data.signedUrl;
}

export async function createSignedUploadUrl(
  db: SupabaseClient,
  storagePath: string,
): Promise<string> {
  const { data, error } = await db.storage.from("podcast").createSignedUploadUrl(
    storagePath,
    { upsert: true },
  );
  if (error || !data?.signedUrl) {
    throw new Error(`createSignedUploadUrl: ${error?.message ?? "missing signedUrl"}`);
  }
  return data.signedUrl;
}

export async function resolveObjectByteSize(
  db: SupabaseClient,
  storagePath: string,
): Promise<number> {
  const slash = storagePath.lastIndexOf("/");
  const folder = slash >= 0 ? storagePath.slice(0, slash) : "";
  const name = slash >= 0 ? storagePath.slice(slash + 1) : storagePath;
  const { data, error } = await db.storage.from("podcast").list(folder, {
    search: name,
    limit: 1,
  });
  if (error) throw new Error(`resolveObjectByteSize list: ${error.message}`);
  const row = data?.find((f) => f.name === name);
  const size = row?.metadata?.size;
  if (typeof size === "number" && size > 0) return size;
  if (typeof size === "string") {
    const n = Number(size);
    if (Number.isFinite(n) && n > 0) return n;
  }
  throw new Error(`resolveObjectByteSize: could not resolve size for ${storagePath}`);
}

export async function storageObjectExists(
  db: SupabaseClient,
  storagePath: string,
): Promise<boolean> {
  try {
    const size = await resolveObjectByteSize(db, storagePath);
    return size > 0;
  } catch {
    return false;
  }
}
