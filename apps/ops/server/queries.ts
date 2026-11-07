import type postgres from "postgres";
import type {
  AttemptView,
  BoardEpisode,
  BoardResponse,
  EpisodeDetail,
  EventView,
  SubscriptionResponse,
} from "../shared/types.ts";
import { HttpError } from "./http-error.ts";
import { sqlClient } from "./local-db.ts";
import {
  presentEpisode,
  type ExternalOp,
  type FailedJob,
  type JobRow,
  type StageSource,
} from "./stages.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value: string): string {
  if (!UUID.test(value)) throw new HttpError(400, "Episode id must be a UUID.");
  return value;
}

type BoardRow = {
  id: string;
  title: string;
  content_path: string | null;
  updated_at: Date;
  scope: string | null;
  trigger: string | null;
  production_id: string | null;
  failed_at: Date | null;
  failure_stage: string | null;
  failure_reason: string | null;
  published_at: Date | null;
  assembled: boolean;
  this_assembled: boolean;
  has_script: boolean;
  has_audio: boolean;
  audio_path: string | null;
  duration_ms: number | null;
  has_artwork: boolean;
  image_path: string | null;
  profile: unknown;
  jobs: JobRow[] | null;
  external_op: ExternalOp | null;
  failed_job: FailedJob | null;
};

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function artworkEnabled(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return true;
  const image = (profile as { image?: { enabled?: unknown } }).image;
  const enabled = image?.enabled;
  return !(enabled === false || enabled === "false" || enabled === 0);
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asJobs(value: unknown): JobRow[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed as JobRow[] : [];
}

function asObject<T>(value: unknown): T | null {
  const parsed = parseJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed as T;
}

function toEpisode(row: BoardRow, now: number): BoardEpisode {
  const jobs = asJobs(row.jobs);
  const external = asObject<ExternalOp>(row.external_op);
  const failedJob = asObject<FailedJob>(row.failed_job);
  const input: StageSource = {
    scope: row.scope,
    failedAt: iso(row.failed_at),
    failureStage: row.failure_stage,
    failureReason: row.failure_reason,
    publishedAt: iso(row.published_at),
    assembled: row.assembled,
    thisAssembled: row.this_assembled,
    hasScript: row.has_script,
    hasAudio: row.has_audio,
    hasArtwork: row.has_artwork,
    audioPath: row.audio_path,
    durationMs: row.duration_ms,
    imagePath: row.image_path,
    artworkEnabled: artworkEnabled(row.profile),
    jobs: jobs.map((job) => ({
      ...job,
      requestedAt: iso(job.requestedAt),
      finishedAt: iso(job.finishedAt),
    })),
    external: external ? { ...external, nextPollAt: iso(external.nextPollAt) } : null,
    failedJob: failedJob ? { ...failedJob, finishedAt: iso(failedJob.finishedAt) } : null,
    now,
  };
  return presentEpisode({
    id: row.id,
    title: row.title,
    path: row.content_path,
    updatedAt: iso(row.updated_at) ?? new Date(now).toISOString(),
    scope: row.scope,
    trigger: row.trigger,
    assembled: row.assembled,
    productionId: row.production_id,
    audioPath: row.audio_path,
    imagePath: row.image_path,
  }, input);
}

export async function loadBoard(): Promise<BoardResponse> {
  const sql = sqlClient();
  const now = Date.now();
  const [episodes, subscription] = await Promise.all([
    sql<BoardRow[]>`
      with latest_prod as (
        select distinct on (episode_id)
          id, episode_id, scope, trigger, requested_at, profile,
          failed_at, failure_stage, failure_reason
        from podcast.productions
        order by episode_id, requested_at desc
      ),
      latest_article as (
        select distinct on (article_id) article_id, title
        from podcast.article_revisions
        order by article_id, registered_at desc
      ),
      latest_rev as (
        select distinct on (episode_id) episode_id, title
        from podcast.episode_revisions
        order by episode_id, assembled_at desc
      ),
      active_pub as (
        select distinct on (er.episode_id)
          er.episode_id,
          ep.published_at
        from podcast.episode_publications ep
        join podcast.episode_revisions er on er.id = ep.episode_revision_id
        where ep.withdrawn_at is null
        order by er.episode_id, ep.published_at desc
      ),
      prod_script as (
        select distinct on (production_id) production_id, title
        from podcast.scripts
        order by production_id, created_at desc
      ),
      prod_audio as (
        select distinct on (a.production_id)
          a.production_id,
          b.storage_path,
          a.duration_ms
        from podcast.audios a
        join podcast.blobs b on b.id = a.blob_id
        order by a.production_id, a.created_at desc
      ),
      prod_art as (
        select distinct on (aw.production_id)
          aw.production_id,
          b.storage_path
        from podcast.artworks aw
        join podcast.blobs b on b.id = aw.blob_id
        order by aw.production_id, aw.created_at desc
      )
      select
        e.id,
        coalesce(lr.title, ps.title, lar.title, 'Untitled') as title,
        a.content_path,
        greatest(
          e.created_at,
          lp.requested_at,
          lp.failed_at,
          ap.published_at,
          (
            select max(coalesce(j.finished_at, j.requested_at))
            from jobs.jobs j
            where j.correlation_id = lp.id
          )
        ) as updated_at,
        lp.scope,
        lp.trigger,
        lp.id as production_id,
        lp.failed_at,
        lp.failure_stage,
        lp.failure_reason,
        ap.published_at,
        exists(
          select 1 from podcast.episode_revisions er where er.episode_id = e.id
        ) as assembled,
        exists(
          select 1 from podcast.episode_revisions er where er.production_id = lp.id
        ) as this_assembled,
        (ps.production_id is not null) as has_script,
        (pa.production_id is not null) as has_audio,
        pa.storage_path as audio_path,
        pa.duration_ms,
        (part.production_id is not null) as has_artwork,
        part.storage_path as image_path,
        lp.profile,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', j.id,
            'jobType', j.job_type,
            'status', j.status,
            'requestedAt', j.requested_at,
            'finishedAt', j.finished_at
          ) order by j.requested_at)
          from jobs.jobs j
          where j.correlation_id = lp.id
        ), '[]'::jsonb) as jobs,
        (
          select jsonb_build_object(
            'state', eo.state,
            'pollCount', eo.poll_count,
            'nextPollAt', eo.next_poll_at
          )
          from jobs.jobs j
          join jobs.job_attempts att on att.job_id = j.id
          join jobs.external_operations eo on eo.attempt_id = att.id
          where j.correlation_id = lp.id
            and j.job_type = 'render_audio'
            and eo.completed_at is null
          order by eo.submitted_at desc
          limit 1
        ) as external_op,
        (
          select jsonb_build_object(
            'id', j.id,
            'jobType', j.job_type,
            'error', att.error_message,
            'finishedAt', j.finished_at
          )
          from jobs.jobs j
          left join lateral (
            select error_message
            from jobs.job_attempts
            where job_id = j.id
            order by attempt_no desc
            limit 1
          ) att on true
          where j.correlation_id = lp.id
            and j.status = 'failed'
          order by j.finished_at desc nulls last
          limit 1
        ) as failed_job
      from podcast.episodes e
      join podcast.articles a on a.id = e.article_id
      left join latest_article lar on lar.article_id = e.article_id
      left join latest_rev lr on lr.episode_id = e.id
      left join latest_prod lp on lp.episode_id = e.id
      left join active_pub ap on ap.episode_id = e.id
      left join prod_script ps on ps.production_id = lp.id
      left join prod_audio pa on pa.production_id = lp.id
      left join prod_art part on part.production_id = lp.id
      order by updated_at desc
      limit 200
    `,
    loadSubscription(sql),
  ]);
  return {
    episodes: episodes.map((row) => toEpisode(row, now)),
    subscription: subscription,
    fetchedAt: new Date(now).toISOString(),
  };
}

type AttemptRow = {
  job_type: string;
  status: string;
  attempt_no: number | null;
  outcome: string | null;
  error_message: string | null;
  started_at: Date | null;
  finished_at: Date | null;
};

type EventRow = {
  position: string;
  occurred_at: Date;
  type: string;
  actor: string;
  stage: string | null;
  reason: string | null;
  scope: string | null;
  failed_job_id: string | null;
};

export async function loadEpisode(episodeId: string): Promise<EpisodeDetail> {
  const id = assertUuid(episodeId);
  const sql = sqlClient();
  const [attempts, events] = await Promise.all([
    sql<AttemptRow[]>`
      select
        j.job_type,
        j.status,
        ja.attempt_no,
        ja.outcome,
        ja.error_message,
        ja.started_at,
        ja.finished_at
      from jobs.jobs j
      left join jobs.job_attempts ja on ja.job_id = j.id
      where j.correlation_id = (
        select id from podcast.productions
        where episode_id = ${id}::uuid
        order by requested_at desc
        limit 1
      )
      order by j.requested_at, ja.attempt_no
    `,
    sql<EventRow[]>`
      select position::text, occurred_at, type, actor, stage, reason, scope, failed_job_id
      from (
        select
          de.position,
          de.occurred_at,
          de.type,
          de.actor,
          de.payload->>'stage' as stage,
          de.payload->>'reason' as reason,
          de.payload->>'scope' as scope,
          de.payload->>'failed_job_id' as failed_job_id
        from podcast.domain_events de
        where de.stream_id = ${id}::uuid
          or de.stream_id in (
            select id from podcast.productions where episode_id = ${id}::uuid
          )
          or de.stream_id = (
            select article_id from podcast.episodes where id = ${id}::uuid
          )
          or de.payload->>'episode_id' = ${id}
        order by de.position desc
        limit 80
      ) recent
      order by position asc
    `,
  ]);
  return {
    attempts: attempts.map(toAttempt),
    events: events.map(toEvent),
  };
}

function toAttempt(row: AttemptRow): AttemptView {
  return {
    jobType: row.job_type,
    status: row.outcome ?? row.status,
    attempt: row.attempt_no == null ? "—" : String(row.attempt_no),
    startedAt: iso(row.started_at),
    finishedAt: iso(row.finished_at),
    note: row.error_message ?? "",
  };
}

function toEvent(row: EventRow): EventView {
  const bits = [
    row.scope ? `scope=${row.scope}` : "",
    row.stage ? `stage=${row.stage}` : "",
    row.failed_job_id ? `failed_job_id=${row.failed_job_id}` : "",
    row.reason ?? "",
  ].filter(Boolean);
  return {
    position: Number(row.position),
    at: iso(row.occurred_at) ?? "",
    type: row.type,
    actor: row.actor,
    note: bits.join(" · "),
  };
}

type CheckpointRow = {
  last_processed_position: string;
  leased_until: Date | null;
};

type FailureRow = {
  event_position: string;
  error_message: string;
  failed_at: Date;
};

type PendingRow = {
  position: string;
  type: string;
  stream_type: string;
  actor: string;
  occurred_at: Date;
};

export async function loadSubscription(sql: postgres.Sql = sqlClient()): Promise<SubscriptionResponse> {
  const [checkpoint, head, failures, pending] = await Promise.all([
    sql<CheckpointRow[]>`
      select last_processed_position::text, leased_until
      from podcast.event_subscriptions
      where subscriber_id = 'production-policy'
      limit 1
    `,
    sql<Array<{ head: string }>>`
      select coalesce(max(position), 0)::text as head
      from podcast.domain_events
    `,
    sql<FailureRow[]>`
      select event_position::text, error_message, failed_at
      from podcast.event_subscription_failures
      where subscriber_id = 'production-policy'
      order by event_position desc
      limit 20
    `,
    sql<PendingRow[]>`
      select position::text, type, stream_type, actor, occurred_at
      from podcast.domain_events
      where position > coalesce((
        select last_processed_position
        from podcast.event_subscriptions
        where subscriber_id = 'production-policy'
      ), 0)
      order by position
      limit 50
    `,
  ]);
  const processed = Number(checkpoint[0]?.last_processed_position ?? 0);
  const latest = Number(head[0]?.head ?? 0);
  const leaseUntil = checkpoint[0]?.leased_until ?? null;
  const leaseExpired = !leaseUntil || leaseUntil.getTime() < Date.now();
  const blocking = failures
    .map((row) => ({
      position: Number(row.event_position),
      failedAt: iso(row.failed_at) ?? "",
      error: row.error_message,
    }))
    .filter((row) => row.position > processed)
    .sort((a, b) => a.position - b.position)[0];
  const lag = Math.max(0, latest - processed);
  return {
    processedPosition: processed,
    latestPosition: latest,
    lag,
    leaseExpired,
    stuck: lag > 0 && leaseExpired
      ? { position: blocking?.position ?? processed + 1, error: blocking?.error ?? null }
      : null,
    pending: pending.map((row) => ({
      position: Number(row.position),
      type: row.type,
      streamType: row.stream_type,
      actor: row.actor,
      at: iso(row.occurred_at) ?? "",
    })),
    failures: failures.map((row) => ({
      position: Number(row.event_position),
      failedAt: iso(row.failed_at) ?? "",
      error: row.error_message,
    })).sort((a, b) => b.position - a.position),
  };
}
