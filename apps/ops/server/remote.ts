import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "./http-error.ts";

export type Remote = {
  projectRef: string;
  apiUrl: string;
  serviceKey: string;
  db: SupabaseClient;
};

type ProjectRow = { id?: string; name?: string; linked?: boolean };

function parseJson<T>(text: string, what: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(503, `${what} did not return JSON. Run supabase login.`);
  }
}

let cached: { at: number; remote: Remote } | undefined;

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

function runCli(args: string[]): string {
  try {
    return execFileSync("supabase", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    const err = error as { status?: number; stderr?: string; code?: string };
    if (err.code === "ENOENT") {
      throw new HttpError(503, "The supabase CLI is not installed. Install it, then run supabase login.");
    }
    const detail = (err.stderr ?? "").trim().split("\n").slice(-3).join(" ");
    throw new HttpError(
      503,
      detail
        ? `supabase ${args[0]} ${args[1] ?? ""} failed: ${detail}`
        : "supabase CLI failed. Run supabase login in this repo.",
    );
  }
}

/** Same discovery as the TUI data client: CLI login, then the linked project. No env vars. */
function discover(): { projectRef: string; serviceKey: string } {
  const projects = parseJson<ProjectRow[]>(runCli(["projects", "list", "-o", "json"]), "supabase projects list");
  if (!Array.isArray(projects) || projects.length === 0) {
    throw new HttpError(503, "supabase projects list returned no projects. Run supabase login.");
  }
  const chosen = projects.length === 1
    ? projects[0]
    : projects.find((project) => project.linked);
  if (!chosen?.id) {
    const lines = projects.map((project) => `${project.id ?? "?"}  ${project.name ?? ""}`).join(", ");
    throw new HttpError(
      503,
      `Several projects are logged in. Link one with supabase link --project-ref <id>. ${lines}`,
    );
  }
  if (!/^[a-z0-9]{8,40}$/i.test(chosen.id)) {
    throw new HttpError(503, "supabase projects list returned a project ref this console will not use.");
  }
  const keys = parseJson<Array<{ name?: string; api_key?: string }>>(
    runCli(["projects", "api-keys", "--project-ref", chosen.id, "-o", "json"]),
    "supabase projects api-keys",
  );
  const serviceKey = keys.find((key) => key.name === "service_role")?.api_key;
  if (!serviceKey) {
    throw new HttpError(503, `supabase projects api-keys did not include a service_role key for ${chosen.id}.`);
  }
  return { projectRef: chosen.id, serviceKey };
}

export function remote(): Remote {
  const now = Date.now();
  if (cached && now - cached.at < 60_000) return cached.remote;
  const found = discover();
  const apiUrl = `https://${found.projectRef}.supabase.co`;
  const db = createClient(apiUrl, found.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const next = { projectRef: found.projectRef, apiUrl, serviceKey: found.serviceKey, db };
  cached = { at: now, remote: next };
  return next;
}
