-- Phase 5: read models for CLI, TUI, and web (podcast.* + jobs.*).
-- Display columns for episodes/articles still join public.* until Phase 6 drops compat writers.

create or replace view podcast.episode_overview as
select
  pe.id,
  pe.article_id,
  coalesce(le.mem_note_id, pa.mem_note_id) as mem_note_id,
  le.title,
  le.description,
  le.status,
  le.audio_url,
  le.image_url,
  le.created_at,
  le.published_at
from podcast.episodes pe
left join public.episodes le on le.id = pe.id
left join podcast.articles pa on pa.id = pe.article_id;

create or replace view podcast.article_overview as
select
  pa.id,
  coalesce(pa.mem_note_id, la.mem_note_id) as mem_note_id,
  coalesce(latest_rev.title, la.title, 'Untitled') as title,
  coalesce(la.content, '') as content,
  coalesce(la.source, 'webhook') as source,
  pa.content_path,
  la.ingest_meta,
  pa.created_at
from podcast.articles pa
left join public.articles la on la.id = pa.id
left join lateral (
  select ar.title
  from podcast.article_revisions ar
  where ar.article_id = pa.id
  order by ar.registered_at desc
  limit 1
) latest_rev on true;

create or replace view podcast.script_overview as
select
  s.id,
  p.episode_id,
  s.content,
  coalesce(ls.status, 'ready') as status,
  ls.error,
  ls.llm_usage,
  ls.llm_response,
  s.created_at
from podcast.scripts s
join podcast.productions p on p.id = s.production_id
left join public.scripts ls on ls.id = s.id;

create or replace view podcast.audio_overview as
select
  a.id,
  p.episode_id,
  b.storage_path,
  b.mime_type,
  coalesce(laf.status, 'ready') as status,
  laf.error,
  laf.llm_usage,
  laf.llm_response,
  a.created_at
from podcast.audios a
join podcast.productions p on p.id = a.production_id
join podcast.blobs b on b.id = a.blob_id
left join public.audio_files laf on laf.id = a.id;

create or replace view jobs.attempt_log as
select
  pl.processed_at,
  pl.queue_name,
  pl.status,
  pl.episode_id,
  pl.article_id,
  pl.duration_ms,
  pl.error_message
from public.processing_logs pl
union all
select
  coalesce(ja.finished_at, ja.started_at) as processed_at,
  j.job_type as queue_name,
  case
    when ja.outcome = 'succeeded' then 'success'
    else 'failure'
  end as status,
  prod.episode_id,
  pe.article_id,
  case
    when ja.finished_at is not null
      then (extract(epoch from (ja.finished_at - ja.started_at)) * 1000)::integer
    else null
  end as duration_ms,
  ja.error_message
from jobs.job_attempts ja
join jobs.jobs j on j.id = ja.job_id
left join podcast.productions prod on prod.id = j.correlation_id
left join podcast.episodes pe on pe.id = prod.episode_id;

create or replace view podcast.published_episode_assets as
with active_pub as (
  select distinct on (er.episode_id)
    er.episode_id,
    er.audio_id,
    er.artwork_id
  from podcast.episode_revisions er
  join podcast.episode_publications ep on ep.episode_revision_id = er.id
  where ep.withdrawn_at is null
  order by er.episode_id, ep.published_at desc
)
select
  pe.id as episode_id,
  pe.article_id,
  ba.storage_path as audio_url,
  bart.storage_path as image_url,
  pa.content_path,
  la.ingest_meta
from active_pub ap
join podcast.episodes pe on pe.id = ap.episode_id
join podcast.audios au on au.id = ap.audio_id
join podcast.blobs ba on ba.id = au.blob_id
left join podcast.artworks aw on aw.id = ap.artwork_id
left join podcast.blobs bart on bart.id = aw.blob_id
join podcast.articles pa on pa.id = pe.article_id
left join public.articles la on la.id = pa.id;

grant select on podcast.episode_overview to service_role, authenticated;
grant select on podcast.article_overview to service_role, authenticated;
grant select on podcast.script_overview to service_role, authenticated;
grant select on podcast.audio_overview to service_role, authenticated;
grant select on podcast.published_episode_assets to anon, authenticated, service_role;
grant select on jobs.attempt_log to service_role, authenticated;
