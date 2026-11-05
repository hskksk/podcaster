import type { PodcastConfigMap } from "../types.ts";

export function isCloudRunExecutionName(operationName: string): boolean {
  return operationName.startsWith("projects/") && operationName.includes("/executions/");
}

export function isGeminiBatchOperationName(operationName: string): boolean {
  return !isCloudRunExecutionName(operationName);
}

export function isTranscodeEnabled(cfg: PodcastConfigMap): boolean {
  const flag = cfg["audio.transcode.enabled"];
  if (flag === false || flag === "false") return false;
  if (flag !== true && flag !== "true") return false;
  // When enabled, delivery_format=wav skips Cloud Run (debug WAV delivery).
  const delivery = String(cfg["audio.delivery.format"] ?? "m4a").toLowerCase();
  if (delivery === "wav") return false;
  return true;
}

export function transcodeBitrateKbps(cfg: PodcastConfigMap): number {
  const n = Number(cfg["audio.transcode.bitrate_kbps"] ?? 128);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 128;
}

function projectIdFromServiceAccountJson(): string {
  const raw = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON")?.trim();
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as { project_id?: string };
    return String(parsed.project_id ?? "").trim();
  } catch {
    return "";
  }
}

/** GCP Run Job placement — Edge env / Secrets only (not podcast_config). */
export function gcpRunConfig(): {
  projectId: string;
  region: string;
  jobName: string;
} {
  const projectId = (
    Deno.env.get("GCP_PROJECT_ID")?.trim()
    || projectIdFromServiceAccountJson()
  );
  const region = Deno.env.get("GCP_REGION")?.trim() || "asia-northeast1";
  const jobName = Deno.env.get("GCP_RUN_JOB_NAME")?.trim() || "audio-transcode";
  return { projectId, region, jobName };
}

export function assertGcpRunConfig(): {
  projectId: string;
  region: string;
  jobName: string;
} {
  const gcp = gcpRunConfig();
  if (!gcp.projectId) {
    throw new Error(
      "GCP_PROJECT_ID (or project_id in GCP_SERVICE_ACCOUNT_JSON) is required for audio transcode",
    );
  }
  if (!gcp.region) throw new Error("GCP_REGION is required for audio transcode");
  if (!gcp.jobName) throw new Error("GCP_RUN_JOB_NAME is required for audio transcode");
  return gcp;
}

export function deliveryMimeType(cfg: PodcastConfigMap): string {
  const container = String(cfg["audio.transcode.container"] ?? "m4a").toLowerCase();
  if (container === "m4a" || container === "mp4") return "audio/mp4";
  return "audio/wav";
}
