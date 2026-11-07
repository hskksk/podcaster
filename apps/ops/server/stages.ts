import type { BoardEpisode, Stage } from "../shared/types.ts";
import { formatDuration, formatJst } from "../shared/time.ts";

const STALL_MS = 10 * 60 * 1000;

export type JobRow = {
  id: string;
  jobType: string;
  status: string;
  requestedAt: string | null;
  finishedAt: string | null;
};

export type ExternalOp = {
  state: string | null;
  pollCount: number;
  nextPollAt: string | null;
};

export type FailedJob = {
  id: string;
  jobType: string;
  error: string | null;
  finishedAt: string | null;
};

export type StageSource = {
  scope: string | null;
  failedAt: string | null;
  failureStage: string | null;
  failureReason: string | null;
  publishedAt: string | null;
  assembled: boolean;
  thisAssembled: boolean;
  hasScript: boolean;
  hasAudio: boolean;
  hasArtwork: boolean;
  audioPath: string | null;
  durationMs: number | null;
  imagePath: string | null;
  artworkEnabled: boolean;
  jobs: JobRow[];
  external: ExternalOp | null;
  failedJob: FailedJob | null;
  now: number;
};

function latestJob(jobs: JobRow[], jobType: string): JobRow | undefined {
  return jobs
    .filter((job) => job.jobType === jobType)
    .sort((a, b) => (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""))[0];
}

function stageForJobType(jobType: string): "script" | "audio" | "artwork" | null {
  if (jobType === "write_script") return "script";
  if (jobType === "render_audio") return "audio";
  if (jobType === "paint_artwork") return "artwork";
  return null;
}

function runningDetail(job: JobRow, now: number): string {
  const start = job.requestedAt ? new Date(job.requestedAt).getTime() : now;
  const sec = Math.max(0, Math.round((now - start) / 1000));
  return `${job.jobType} · running for ${sec}s`;
}

function waitingDetail(external: ExternalOp | null, now: number): string {
  if (!external) return "Waiting on an external operation";
  const polls = `polled ${external.pollCount} times`;
  if (!external.nextPollAt) return `Gemini batch · ${polls}`;
  const delta = new Date(external.nextPollAt).getTime() - now;
  if (delta >= 0) {
    const sec = Math.max(1, Math.round(delta / 1000));
    return `Gemini batch · ${polls} · next poll in ${sec}s`;
  }
  const min = Math.max(1, Math.round(-delta / 60000));
  return `Polled ${external.pollCount} times · next_poll_at was ${min} minutes ago`;
}

function jobStage(job: JobRow | undefined, external: ExternalOp | null, now: number): Stage | null {
  if (!job) return null;
  if (job.status === "failed") {
    return { kind: "failed", label: "Failed", detail: `${job.jobType} · stopped after retries` };
  }
  if (job.status === "running" || job.status === "requested") {
    return { kind: "running", label: "Running", detail: runningDetail(job, now) };
  }
  if (job.status === "waiting_external") {
    return { kind: "waiting", label: "Waiting", detail: waitingDetail(external, now) };
  }
  return null;
}

function scriptStage(input: StageSource): Stage {
  const job = latestJob(input.jobs, "write_script");
  if (input.failedAt && input.failureStage === "script") {
    return { kind: "failed", label: "Failed", detail: "stage=script · stopped after retries" };
  }
  if ((input.scope === "audio" || input.scope === "artwork") && !input.hasScript && !job) {
    return { kind: "reused", label: "Reused", detail: "Script from the latest assembled version" };
  }
  if (input.hasScript) return { kind: "done", label: "Done", detail: "ScriptWritten" };
  return jobStage(job, null, input.now) ?? { kind: "idle", label: "Not started", detail: "" };
}

function audioStage(input: StageSource): Stage {
  const job = latestJob(input.jobs, "render_audio");
  if (input.failedAt && input.failureStage === "audio") {
    const beforeJob = input.failureReason === "audio scope requires base script";
    return {
      kind: "failed",
      label: "Failed",
      detail: beforeJob ? "Stopped before a job · failed_job_id=null" : "stage=audio · stopped after retries",
    };
  }
  if (input.scope === "artwork" && !input.hasAudio && !job) {
    return { kind: "reused", label: "Reused", detail: "Not rebuilt by this request" };
  }
  if (input.hasAudio) {
    const duration = formatDuration(input.durationMs);
    const detail = [input.audioPath, duration].filter(Boolean).join(" · ");
    return { kind: "done", label: "Done", detail: detail || "AudioRendered" };
  }
  const fromJob = jobStage(job, input.external, input.now);
  if (fromJob) return fromJob;
  if (input.failedAt && input.failureStage === "script") {
    return { kind: "idle", label: "Not started", detail: "Not requested, because the script did not finish" };
  }
  return { kind: "idle", label: "Not started", detail: "" };
}

function artworkStage(input: StageSource): Stage {
  const job = latestJob(input.jobs, "paint_artwork");
  if (input.failedAt && input.failureStage === "artwork") {
    const beforeJob = input.failureReason === "artwork scope requires base script";
    return {
      kind: "failed",
      label: "Failed",
      detail: beforeJob ? "Stopped before a job · failed_job_id=null" : "stage=artwork · stopped after retries",
    };
  }
  if (!input.artworkEnabled && !input.hasArtwork && !job) {
    return { kind: "off", label: "Off", detail: "Artwork is disabled in the profile" };
  }
  if (input.scope === "audio" && !input.hasArtwork && !job) {
    return { kind: "reused", label: "Reused", detail: "Not rebuilt by this request" };
  }
  if (input.hasArtwork) {
    return { kind: "done", label: "Done", detail: input.imagePath ?? "ArtworkPainted" };
  }
  const fromJob = jobStage(job, null, input.now);
  if (fromJob) return fromJob;
  if (input.failedAt && input.failureStage === "script") {
    return { kind: "idle", label: "Not started", detail: "Not requested, because the script did not finish" };
  }
  if (input.publishedAt && !input.hasArtwork) {
    return { kind: "idle", label: "No artwork", detail: "The published version has no artwork. There is no ProductionFailed" };
  }
  return { kind: "idle", label: "Not started", detail: "" };
}

function publishStage(input: StageSource): Stage {
  if (input.publishedAt) {
    return {
      kind: "live",
      label: "Published",
      detail: input.failedAt
        ? "published_at of the published version remains"
        : `Published ${formatJst(input.publishedAt)}`,
    };
  }
  if (input.thisAssembled) {
    return { kind: "idle", label: "Unpublished", detail: "Assembled, not published" };
  }
  return { kind: "idle", label: "Unpublished", detail: "No assembled version" };
}

export function overviewStatus(input: StageSource): string {
  if (input.failedAt) {
    if (input.failureStage === "script") return "script_failed";
    if (input.failureStage === "audio") return "audio_failed";
    if (input.failureStage === "artwork") return "image_failed";
    return "failed";
  }
  if (input.publishedAt) return "published";
  if (input.assembled) return "audio_ready";
  if (input.hasAudio) return "audio_generated";
  if (input.hasScript) return "script_ready";
  return "ingested";
}

function stallMessage(input: StageSource): string | null {
  const audio = latestJob(input.jobs, "render_audio");
  if (audio?.status !== "waiting_external" || !input.external?.nextPollAt) return null;
  const late = input.now - new Date(input.external.nextPollAt).getTime();
  if (late <= STALL_MS) return null;
  const minutes = Math.max(1, Math.round(late / 60000));
  return `The next render_audio poll is ${minutes} minutes overdue. ProductionFailed has not been recorded`;
}

export function presentEpisode(
  base: Omit<BoardEpisode, "stages" | "failure" | "stall" | "active" | "attention" | "overviewStatus" | "published">,
  input: StageSource,
): BoardEpisode {
  const stall = input.failedAt ? null : stallMessage(input);
  const jobStageName = input.failedJob ? stageForJobType(input.failedJob.jobType) : null;
  const failure = input.failedAt
    ? {
      stage: input.failureStage,
      reason: input.failureReason?.trim() || "job failed after retries",
      failedJobId: input.failedJob?.id ?? null,
      at: input.failedAt,
    }
    : input.failedJob
      ? {
        stage: jobStageName,
        reason: input.failedJob.error?.trim() || "job failed after retries",
        failedJobId: input.failedJob.id,
        at: input.failedJob.finishedAt,
      }
      : null;
  const active = input.jobs.some((job) =>
    job.status === "requested" || job.status === "running" || job.status === "waiting_external"
  );
  const attention = failure ? "failed" : stall ? "stalled" : null;
  return {
    ...base,
    published: input.publishedAt != null,
    overviewStatus: overviewStatus(input),
    stages: {
      script: scriptStage(input),
      audio: audioStage(input),
      artwork: artworkStage(input),
      publish: publishStage(input),
    },
    failure,
    stall,
    active,
    attention,
  };
}
