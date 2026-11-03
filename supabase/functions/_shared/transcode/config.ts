import type { PodcastConfigMap } from "../types.ts";

export function isCloudRunExecutionName(operationName: string): boolean {
  return operationName.startsWith("projects/");
}

export function isGeminiBatchOperationName(operationName: string): boolean {
  return !isCloudRunExecutionName(operationName);
}

export function isTranscodeEnabled(cfg: PodcastConfigMap): boolean {
  const delivery = String(cfg["audio.delivery.format"] ?? "m4a").toLowerCase();
  if (delivery === "wav") return false;
  const flag = cfg["audio.transcode.enabled"];
  if (flag === false || flag === "false") return false;
  if (flag === true || flag === "true") return true;
  return false;
}

export function transcodeBitrateKbps(cfg: PodcastConfigMap): number {
  const n = Number(cfg["audio.transcode.bitrate_kbps"] ?? 128);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 128;
}

export function gcpRunConfig(cfg: PodcastConfigMap): {
  projectId: string;
  region: string;
  jobName: string;
} {
  const projectId = String(cfg["gcp.project_id"] ?? "").trim();
  const region = String(cfg["gcp.region"] ?? "asia-northeast1").trim();
  const jobName = String(cfg["gcp.run.job_name"] ?? "audio-transcode").trim();
  return { projectId, region, jobName };
}

export function assertGcpRunConfig(cfg: PodcastConfigMap): {
  projectId: string;
  region: string;
  jobName: string;
} {
  const gcp = gcpRunConfig(cfg);
  if (!gcp.projectId) throw new Error("gcp.project_id is required for audio transcode");
  if (!gcp.region) throw new Error("gcp.region is required for audio transcode");
  if (!gcp.jobName) throw new Error("gcp.run.job_name is required for audio transcode");
  return gcp;
}

export function deliveryMimeType(cfg: PodcastConfigMap): string {
  const container = String(cfg["audio.transcode.container"] ?? "m4a").toLowerCase();
  if (container === "m4a" || container === "mp4") return "audio/mp4";
  return "audio/wav";
}
