import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BoardEpisode,
  BoardResponse,
  EpisodeDetail,
  EventView,
  SubscriptionResponse,
  TextView,
} from "../shared/types.ts";
import { HttpError } from "./http-error.ts";
import { remote, type Remote } from "./remote.ts";
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
  updated_at: string;
  scope: string | null;
  trigger: string | null;
  production_id: string | null;
  failed_at: string | null;
  failure_stage: string | null;
  failure_reason: string | null;
  published_at: string | null;
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

type EpisodeRow = { id: string; article_id: string; created_at: string };
type ArticleRow = { id: string; content_path: string | null };
type ProductionRow = {
  id: string;
  episode_id: string;
  scope: string;
  trigger: string;
  requested_at: string;
  profile: unknown;
  failed_at: string | null;
  failure_stage: string | null;
  failure_reason: string | null;
};
type RevisionRow = { id: string; episode_id: string; production_id: string; title: string; assembled_at: string };
type ArticleTitleRow = { article_id: string; title: string; registered_at: string };
type ScriptRow = { production_id: string; title: string; created_at: string };
type AudioRow = { production_id: string; blob_id: string; duration_ms: number | null; created_at: string };
type ArtworkRow = { production_id: string; blob_id: string; created_at: string };
type BlobRow = { id: string; storage_path: string };
type PublicationRow = { episode_revision_id: string; published_at: string };
type JobDbRow = {
  id: string;
  correlation_id: string | null;
  job_type: string;
  status: string;
  requested_at: string;
  finished_at: string | null;
};
type AttemptDbRow = {
  id: string;
  job_id: string;
  attempt_no: number | null;
  outcome: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
};
type ExternalDbRow = {
  attempt_id: string;
  state: string | null;
  poll_count: number | null;
  next_poll_at: string | null;
  submitted_at: string;
};
type EventDbRow = {
  position: number | string;
  occurred_at: string;
  type: string;
  actor: string;
  stage: string | null;
  reason: string | null;
  scope: string | null;
  failed_job_id: string | null;
};
type PendingDbRow = {
  position: number | string;
  type: string;
  stream_type: string;
  actor: string;
  occurred_at: string;
};
type FailureDbRow = {
  event_position: number | string;
  error_message: string;
  failed_at: string;
};

function iso(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function artworkEnabled(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return true;
  const image = (profile as { image?: { enabled?: unknown } }).image;
  const enabled = image?.enabled;
  return !(enabled === false || enabled === "false" || enabled === 0);
}

function fail(ref: string, label: string, message: string): never {
  throw new HttpError(502, `${label} on project ${ref} failed: ${message}`);
}

async function rowsOf<T>(
  ref: string,
  label: string,
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const result = await query;
  if (result.error) fail(ref, label, result.error.message);
  return (result.data ?? []) as T[];
}

async function selectIn<T>(
  ref: string,
  label: string,
  ids: string[],
  run: (chunk: string[]) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let index = 0; index < ids.length; index += 80) {
    out.push(...await rowsOf<T>(ref, label, run(ids.slice(index, index + 80))));
  }
  return out;
}

function latestBy<T>(rows: T[], key: (row: T) => string, time: (row: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const id = key(row);
    const prev = map.get(id);
    if (!prev || time(row) > time(prev)) map.set(id, row);
  }
  return map;
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const list = map.get(id);
    if (list) list.push(row);
    else map.set(id, [row]);
  }
  return map;
}

function podcast(db: SupabaseClient) {
  return db.schema("podcast");
}

function jobsSchema(db: SupabaseClient) {
  return db.schema("jobs");
}

function toEpisode(row: BoardRow, now: number): BoardEpisode {
  const jobs = Array.isArray(row.jobs) ? row.jobs : [];
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
    external: row.external_op
      ? { ...row.external_op, nextPollAt: iso(row.external_op.nextPollAt) }
      : null,
    failedJob: row.failed_job
      ? { ...row.failed_job, finishedAt: iso(row.failed_job.finishedAt) }
      : null,
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
  const link = remote();
  const now = Date.now();
  const [episodes, subscription] = await Promise.all([
    loadEpisodeRows(link),
    loadSubscription(),
  ]);
  return {
    projectRef: link.projectRef,
    episodes: episodes.map((row) => toEpisode(row, now)),
    subscription,
    fetchedAt: new Date(now).toISOString(),
  };
}

async function loadEpisodeRows(link: Remote): Promise<BoardRow[]> {
  const db = podcast(link.db);
  const episodes = await rowsOf<EpisodeRow>(
    link.projectRef,
    "episodes",
    db.from("episodes").select("id, article_id, created_at").order("created_at", { ascending: false }).limit(1000),
  );
  if (episodes.length === 0) return [];
  const episodeIds = episodes.map((row) => row.id);
  const articleIds = [...new Set(episodes.map((row) => row.article_id))];
  const [articles, productions, revisions, articleTitles] = await Promise.all([
    selectIn<ArticleRow>(link.projectRef, "articles", articleIds, (ids) =>
      db.from("articles").select("id, content_path").in("id", ids)),
    selectIn<ProductionRow>(link.projectRef, "productions", episodeIds, (ids) =>
      db.from("productions").select("id, episode_id, scope, trigger, requested_at, profile, failed_at, failure_stage, failure_reason").in("episode_id", ids)),
    selectIn<RevisionRow>(link.projectRef, "episode revisions", episodeIds, (ids) =>
      db.from("episode_revisions").select("id, episode_id, production_id, title, assembled_at").in("episode_id", ids)),
    selectIn<ArticleTitleRow>(link.projectRef, "article revisions", articleIds, (ids) =>
      db.from("article_revisions").select("article_id, title, registered_at").in("article_id", ids)),
  ]);
  const latestProduction = latestBy(productions, (row) => row.episode_id, (row) => row.requested_at);
  const productionIds = [...latestProduction.values()].map((row) => row.id);
  const revisionIds = revisions.map((row) => row.id);
  const [scripts, audios, artworks, publications, jobRows] = await Promise.all([
    selectIn<ScriptRow>(link.projectRef, "scripts", productionIds, (ids) =>
      db.from("scripts").select("production_id, title, created_at").in("production_id", ids)),
    selectIn<AudioRow>(link.projectRef, "audios", productionIds, (ids) =>
      db.from("audios").select("production_id, blob_id, duration_ms, created_at").in("production_id", ids)),
    selectIn<ArtworkRow>(link.projectRef, "artworks", productionIds, (ids) =>
      db.from("artworks").select("production_id, blob_id, created_at").in("production_id", ids)),
    selectIn<PublicationRow>(link.projectRef, "publications", revisionIds, (ids) =>
      db.from("episode_publications").select("episode_revision_id, published_at, withdrawn_at").is("withdrawn_at", null).in("episode_revision_id", ids)),
    selectIn<JobDbRow>(link.projectRef, "jobs", productionIds, (ids) =>
      jobsSchema(link.db).from("jobs").select("id, correlation_id, job_type, status, requested_at, finished_at").in("correlation_id", ids).limit(2000)),
  ]);
  const blobIds = [...new Set([...audios.map((row) => row.blob_id), ...artworks.map((row) => row.blob_id)])];
  const jobIds = jobRows.map((row) => row.id);
  const [blobs, attempts] = await Promise.all([
    selectIn<BlobRow>(link.projectRef, "blobs", blobIds, (ids) =>
      db.from("blobs").select("id, storage_path").in("id", ids)),
    selectIn<AttemptDbRow>(link.projectRef, "job attempts", jobIds, (ids) =>
      jobsSchema(link.db).from("job_attempts").select("id, job_id, attempt_no, error_message, finished_at").in("job_id", ids).limit(5000)),
  ]);
  const audioJobIds = new Set(jobRows.filter((job) => job.job_type === "render_audio").map((job) => job.id));
  const audioAttemptIds = attempts.filter((row) => audioJobIds.has(row.job_id)).map((row) => row.id);
  const externals = await selectIn<ExternalDbRow>(link.projectRef, "external operations", audioAttemptIds, (ids) =>
    jobsSchema(link.db).from("external_operations").select("attempt_id, state, poll_count, next_poll_at, submitted_at").is("completed_at", null).in("attempt_id", ids).limit(500));
  return assembleBoard(episodes, articles, latestProduction, revisions, articleTitles, scripts, audios, artworks, publications, jobRows, blobs, attempts, externals);
}

function assembleBoard(
  episodes: EpisodeRow[],
  articles: ArticleRow[],
  latestProduction: Map<string, ProductionRow>,
  revisions: RevisionRow[],
  articleTitles: ArticleTitleRow[],
  scripts: ScriptRow[],
  audios: AudioRow[],
  artworks: ArtworkRow[],
  publications: PublicationRow[],
  jobRows: JobDbRow[],
  blobs: BlobRow[],
  attempts: AttemptDbRow[],
  externals: ExternalDbRow[],
): BoardRow[] {
  const articleById = new Map(articles.map((row) => [row.id, row]));
  const latestRevision = latestBy(revisions, (row) => row.episode_id, (row) => row.assembled_at);
  const revisionsByEpisode = groupBy(revisions, (row) => row.episode_id);
  const latestArticleTitle = latestBy(articleTitles, (row) => row.article_id, (row) => row.registered_at);
  const latestScript = latestBy(scripts, (row) => row.production_id, (row) => row.created_at);
  const latestAudio = latestBy(audios, (row) => row.production_id, (row) => row.created_at);
  const latestArtwork = latestBy(artworks, (row) => row.production_id, (row) => row.created_at);
  const blobById = new Map(blobs.map((row) => [row.id, row.storage_path]));
  const revisionById = new Map(revisions.map((row) => [row.id, row]));
  const publishedAt = new Map<string, string>();
  for (const row of publications) {
    const revision = revisionById.get(row.episode_revision_id);
    if (!revision) continue;
    const prev = publishedAt.get(revision.episode_id);
    if (!prev || row.published_at > prev) publishedAt.set(revision.episode_id, row.published_at);
  }
  const jobsByProduction = groupBy(
    jobRows.filter((row) => row.correlation_id),
    (row) => row.correlation_id as string,
  );
  const attemptsByJob = groupBy(attempts, (row) => row.job_id);
  const jobIdByAttempt = new Map(attempts.map((row) => [row.id, row.job_id]));

  return episodes.map((episode) => {
    const production = latestProduction.get(episode.id) ?? null;
    const revision = latestRevision.get(episode.id) ?? null;
    const script = production ? latestScript.get(production.id) ?? null : null;
    const audio = production ? latestAudio.get(production.id) ?? null : null;
    const artwork = production ? latestArtwork.get(production.id) ?? null : null;
    const jobs = production ? jobsByProduction.get(production.id) ?? [] : [];
    const failed = [...jobs].filter((job) => job.status === "failed").sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""))[0];
    const failedAttempt = failed
      ? [...(attemptsByJob.get(failed.id) ?? [])].sort((a, b) => (b.attempt_no ?? 0) - (a.attempt_no ?? 0))[0]
      : undefined;
    const audioJob = [...jobs].filter((job) => job.job_type === "render_audio").sort((a, b) => b.requested_at.localeCompare(a.requested_at))[0];
    const external = externals
      .filter((row) => audioJob && jobIdByAttempt.get(row.attempt_id) === audioJob.id)
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0];
    const times = [
      episode.created_at,
      production?.requested_at,
      production?.failed_at,
      publishedAt.get(episode.id),
      ...jobs.map((job) => job.finished_at ?? job.requested_at),
    ].filter((value): value is string => Boolean(value));
    times.sort();
    return {
      id: episode.id,
      title: revision?.title || script?.title || latestArticleTitle.get(episode.article_id)?.title || "Untitled",
      content_path: articleById.get(episode.article_id)?.content_path ?? null,
      updated_at: times[times.length - 1] ?? episode.created_at,
      scope: production?.scope ?? null,
      trigger: production?.trigger ?? null,
      production_id: production?.id ?? null,
      failed_at: production?.failed_at ?? null,
      failure_stage: production?.failure_stage ?? null,
      failure_reason: production?.failure_reason ?? null,
      published_at: publishedAt.get(episode.id) ?? null,
      assembled: (revisionsByEpisode.get(episode.id) ?? []).length > 0,
      this_assembled: (revisionsByEpisode.get(episode.id) ?? []).some((row) => row.production_id === production?.id),
      has_script: script != null,
      has_audio: audio != null,
      audio_path: audio ? blobById.get(audio.blob_id) ?? null : null,
      duration_ms: audio?.duration_ms ?? null,
      has_artwork: artwork != null,
      image_path: artwork ? blobById.get(artwork.blob_id) ?? null : null,
      profile: production?.profile ?? null,
      jobs: jobs.map((job) => ({
        id: job.id,
        jobType: job.job_type,
        status: job.status,
        requestedAt: job.requested_at,
        finishedAt: job.finished_at,
      })),
      external_op: external
        ? { state: external.state, pollCount: external.poll_count ?? 0, nextPollAt: external.next_poll_at }
        : null,
      failed_job: failed
        ? {
          id: failed.id,
          jobType: failed.job_type,
          error: failedAttempt?.error_message ?? null,
          finishedAt: failed.finished_at,
        }
        : null,
    };
  }).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 200);
}

export async function loadEpisode(episodeId: string): Promise<EpisodeDetail> {
  const id = assertUuid(episodeId);
  const link = remote();
  const db = podcast(link.db);
  const episodeResult = await db.from("episodes").select("article_id").eq("id", id).maybeSingle();
  if (episodeResult.error) fail(link.projectRef, "episode", episodeResult.error.message);
  const articleId = (episodeResult.data as { article_id: string } | null)?.article_id ?? null;
  const productions = await rowsOf<{
    id: string;
    requested_at: string;
    article_revision_id: string;
    base_revision_id: string | null;
  }>(
    link.projectRef,
    "productions",
    db.from("productions").select("id, requested_at, article_revision_id, base_revision_id").eq("episode_id", id).order("requested_at", { ascending: false }),
  );
  const latest = productions[0];
  const productionIds = productions.map((row) => row.id);
  const jobRows = latest
    ? await rowsOf<JobDbRow>(
      link.projectRef,
      "jobs",
      jobsSchema(link.db).from("jobs").select("id, job_type, status, requested_at, finished_at").eq("correlation_id", latest.id).order("requested_at"),
    )
    : [];
  const attempts = jobRows.length === 0
    ? []
    : await selectIn<AttemptDbRow>(link.projectRef, "job attempts", jobRows.map((row) => row.id), (ids) =>
      jobsSchema(link.db).from("job_attempts").select("job_id, attempt_no, outcome, error_message, started_at, finished_at").in("job_id", ids).order("attempt_no"));
  const attemptsByJob = groupBy(attempts, (row) => row.job_id);
  const eventSelect = "position, occurred_at, type, actor, stage:payload->>stage, reason:payload->>reason, scope:payload->>scope, failed_job_id:payload->>failed_job_id";
  const eventQueries = [
    rowsOf<EventDbRow>(link.projectRef, "events", db.from("domain_events").select(eventSelect).eq("stream_id", id).order("position", { ascending: false }).limit(80)),
    rowsOf<EventDbRow>(link.projectRef, "events", db.from("domain_events").select(eventSelect).filter("payload->>episode_id", "eq", id).order("position", { ascending: false }).limit(80)),
  ];
  if (articleId) {
    eventQueries.push(rowsOf<EventDbRow>(link.projectRef, "events", db.from("domain_events").select(eventSelect).eq("stream_id", articleId).order("position", { ascending: false }).limit(80)));
  }
  if (productionIds.length > 0) {
    eventQueries.push(selectIn<EventDbRow>(link.projectRef, "events", productionIds, (ids) =>
      db.from("domain_events").select(eventSelect).in("stream_id", ids).order("position", { ascending: false }).limit(80)));
  }
  const eventGroups = await Promise.all(eventQueries);
  const texts = await loadTexts(link, articleId, latest, productionIds);
  const seen = new Set<number>();
  const events = eventGroups.flat().filter((row) => {
    const position = Number(row.position);
    if (seen.has(position)) return false;
    seen.add(position);
    return true;
  }).sort((a, b) => Number(a.position) - Number(b.position)).slice(-80);

  return {
    attempts: jobRows.flatMap((job) => {
      const rows = attemptsByJob.get(job.id) ?? [];
      if (rows.length === 0) {
        return [{
          jobType: job.job_type,
          status: job.status,
          attempt: "—",
          startedAt: null,
          finishedAt: iso(job.finished_at),
          note: "",
        }];
      }
      return [...rows].sort((a, b) => (a.attempt_no ?? 0) - (b.attempt_no ?? 0)).map((row) => ({
        jobType: job.job_type,
        status: row.outcome ?? job.status,
        attempt: row.attempt_no == null ? "—" : String(row.attempt_no),
        startedAt: iso(row.started_at),
        finishedAt: iso(row.finished_at),
        note: row.error_message ?? "",
      }));
    }),
    events: events.map(toEvent),
    article: texts.article,
    script: texts.script,
  };
}

async function loadTexts(
  link: Remote,
  articleId: string | null,
  latest: { id: string; article_revision_id: string; base_revision_id: string | null } | undefined,
  productionIds: string[],
): Promise<{ article: TextView | null; script: TextView | null }> {
  const db = podcast(link.db);
  const articleQuery = latest?.article_revision_id
    ? db.from("article_revisions").select("title, content").eq("id", latest.article_revision_id).maybeSingle()
    : articleId
      ? db.from("article_revisions").select("title, content").eq("article_id", articleId).order("registered_at", { ascending: false }).limit(1).maybeSingle()
      : null;
  const articleResult = articleQuery ? await articleQuery : { data: null, error: null };
  if (articleResult.error) fail(link.projectRef, "article", articleResult.error.message);
  const articleRow = articleResult.data as { title: string; content: string } | null;
  const article = articleRow ? { title: articleRow.title, body: articleRow.content } : null;

  if (productionIds.length === 0) return { article, script: null };
  const heads = await selectIn<{ id: string; production_id: string; created_at: string }>(
    link.projectRef,
    "scripts",
    productionIds,
    (ids) => db.from("scripts").select("id, production_id, created_at").in("production_id", ids),
  );
  const newest = (rows: typeof heads) => [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  let chosen = latest ? newest(heads.filter((row) => row.production_id === latest.id)) : undefined;
  if (!chosen && latest?.base_revision_id) {
    const revision = await db.from("episode_revisions").select("script_id").eq("id", latest.base_revision_id).maybeSingle();
    if (revision.error) fail(link.projectRef, "episode revision", revision.error.message);
    const scriptId = (revision.data as { script_id: string } | null)?.script_id;
    chosen = scriptId ? heads.find((row) => row.id === scriptId) : undefined;
  }
  chosen ??= newest(heads);
  if (!chosen) return { article, script: null };
  const scriptResult = await db.from("scripts").select("title, content").eq("id", chosen.id).maybeSingle();
  if (scriptResult.error) fail(link.projectRef, "script", scriptResult.error.message);
  const scriptRow = scriptResult.data as { title: string; content: string } | null;
  return { article, script: scriptRow ? { title: scriptRow.title, body: scriptRow.content } : null };
}

function toEvent(row: EventDbRow): EventView {
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

export async function loadSubscription(): Promise<SubscriptionResponse> {
  const link = remote();
  const db = podcast(link.db);
  const [checkpointResult, headResult, failures] = await Promise.all([
    db.from("event_subscriptions").select("last_processed_position, leased_until").eq("subscriber_id", "production-policy").maybeSingle(),
    db.from("domain_events").select("position").order("position", { ascending: false }).limit(1).maybeSingle(),
    rowsOf<FailureDbRow>(link.projectRef, "subscription failures", db.from("event_subscription_failures").select("event_position, error_message, failed_at").eq("subscriber_id", "production-policy").order("event_position", { ascending: false }).limit(20)),
  ]);
  if (checkpointResult.error) fail(link.projectRef, "subscription", checkpointResult.error.message);
  if (headResult.error) fail(link.projectRef, "event head", headResult.error.message);
  const checkpoint = checkpointResult.data as { last_processed_position: number | string; leased_until: string | null } | null;
  const processed = Number(checkpoint?.last_processed_position ?? 0);
  const pending = await rowsOf<PendingDbRow>(
    link.projectRef,
    "unprocessed events",
    db.from("domain_events").select("position, type, stream_type, actor, occurred_at").gt("position", processed).order("position").limit(50),
  );
  const latest = Number((headResult.data as { position: number | string } | null)?.position ?? 0);
  const leaseUntil = checkpoint?.leased_until ? new Date(checkpoint.leased_until).getTime() : null;
  const leaseExpired = leaseUntil == null || leaseUntil < Date.now();
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
