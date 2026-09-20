// Same check @pgflow/edge-worker uses to pick its zero-config local pooler.
function isLocalSupabase(env: { get(key: string): string | undefined }): boolean {
  const url = env.get("SUPABASE_URL");
  if (!url) return false;
  try {
    return new URL(url).host === "kong:8000";
  } catch {
    return false;
  }
}

/**
 * Connection string to pass to `EdgeWorker.start(flow, { connectionString })`.
 *
 * Returns undefined whenever @pgflow/edge-worker's own resolution should win:
 * - EDGE_WORKER_DB_URL is set (it reads that variable itself, unmodified), or
 * - we are on local Supabase (it falls back to the Docker pooler).
 *
 * Otherwise it falls back to the platform-managed SUPABASE_DB_URL, so the
 * workers still register if the hand-set secret is missing. Direct connections
 * reject non-SSL clients ("no pg_hba.conf entry ... no encryption"), and it is
 * not known whether SUPABASE_DB_URL carries sslmode, so it is added here.
 */
export function workerConnectionString(
  env: { get(key: string): string | undefined } = Deno.env,
): string | undefined {
  if (env.get("EDGE_WORKER_DB_URL") || isLocalSupabase(env)) return undefined;

  const raw = env.get("SUPABASE_DB_URL");
  if (!raw) return undefined;
  if (/[?&]sslmode=/.test(raw)) return raw;
  return `${raw}${raw.includes("?") ? "&" : "?"}sslmode=require`;
}
