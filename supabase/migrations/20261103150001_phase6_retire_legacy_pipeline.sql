-- Phase 6: rename legacy tables, podcast-only reader views, remove craftEpisode flows.

alter table podcast.articles
  add column if not exists source text not null default 'webhook',
  add column if not exists ingest_route text,
  add column if not exists ingest_meta jsonb;

update podcast.articles pa
set
  source = coalesce(a.source, 'webhook'),
  ingest_route = a.ingest_route,
  ingest_meta = a.ingest_meta
from public.articles a
where a.id = pa.id;

alter table public.articles rename to legacy_articles;
alter table public.episodes rename to legacy_episodes;
alter table public.scripts rename to legacy_scripts;
alter table public.audio_files rename to legacy_audio_files;
alter table public.processing_logs rename to legacy_processing_logs;

create or replace view podcast.episode_overview as
with latest_rev as (
  select distinct on (er.episode_id)
    er.episode_id,
    er.title,
    er.description,
    er.assembled_at
  from podcast.episode_revisions er
  order by er.episode_id, er.assembled_at desc
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
latest_prod as (
  select distinct on (p.episode_id)
    p.id as production_id,
    p.episode_id
  from podcast.productions p
  order by p.episode_id, p.requested_at desc
),
latest_script as (
  select distinct on (s.production_id)
    s.production_id,
    s.title,
    s.description
  from podcast.scripts s
  order by s.production_id, s.created_at desc
),
latest_audio as (
  select distinct on (a.production_id)
    a.production_id,
    b.storage_path as audio_url
  from podcast.audios a
  join podcast.blobs b on b.id = a.blob_id
  order by a.production_id, a.created_at desc
),
latest_art as (
  select distinct on (aw.production_id)
    aw.production_id,
    b.storage_path as image_url
  from podcast.artworks aw
  join podcast.blobs b on b.id = aw.blob_id
  order by aw.production_id, aw.created_at desc
)
select
  e.id,
  e.article_id,
  pa.mem_note_id,
  left(coalesce(lr.title, ls.title, 'Untitled'), 20) as title,
  coalesce(lr.description, ls.description, '') as description,
  case
    when ap.published_at is not null then 'published'
    when lr.episode_id is not null then 'audio_ready'
    when la.production_id is not null then 'audio_generated'
    when ls.production_id is not null then 'script_ready'
    else 'ingested'
  end as status,
  coalesce(la.audio_url, 'audio/' || e.id::text || '.wav') as audio_url,
  lart.image_url,
  e.created_at,
  ap.published_at
from podcast.episodes e
join podcast.articles pa on pa.id = e.article_id
left join latest_rev lr on lr.episode_id = e.id
left join active_pub ap on ap.episode_id = e.id
left join latest_prod lp on lp.episode_id = e.id
left join latest_script ls on ls.production_id = lp.production_id
left join latest_audio la on la.production_id = lp.production_id
left join latest_art lart on lart.production_id = lp.production_id;

create or replace view podcast.article_overview as
select
  pa.id,
  pa.mem_note_id,
  coalesce(lar.title, 'Untitled') as title,
  coalesce(lar.content, '') as content,
  pa.source,
  pa.content_path,
  pa.ingest_meta,
  pa.created_at
from podcast.articles pa
left join lateral (
  select ar.title, ar.content
  from podcast.article_revisions ar
  where ar.article_id = pa.id
  order by ar.registered_at desc
  limit 1
) lar on true;

create or replace view podcast.script_overview as
select
  s.id,
  p.episode_id,
  s.content,
  'ready'::text as status,
  null::text as error,
  null::jsonb as llm_usage,
  null::jsonb as llm_response,
  s.created_at
from podcast.scripts s
join podcast.productions p on p.id = s.production_id;

create or replace view podcast.audio_overview as
select
  a.id,
  p.episode_id,
  b.storage_path,
  b.mime_type,
  'ready'::text as status,
  null::text as error,
  null::jsonb as llm_usage,
  null::jsonb as llm_response,
  a.created_at
from podcast.audios a
join podcast.productions p on p.id = a.production_id
join podcast.blobs b on b.id = a.blob_id;

create or replace view jobs.attempt_log as
select
  pl.processed_at,
  pl.queue_name,
  pl.status,
  pl.episode_id,
  pl.article_id,
  pl.duration_ms,
  pl.error_message
from public.legacy_processing_logs pl
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
  pa.ingest_meta
from active_pub ap
join podcast.episodes pe on pe.id = ap.episode_id
join podcast.audios au on au.id = ap.audio_id
join podcast.blobs ba on ba.id = au.blob_id
left join podcast.artworks aw on aw.id = ap.artwork_id
left join podcast.blobs bart on bart.id = aw.blob_id
join podcast.articles pa on pa.id = pe.article_id;

select pgflow.delete_flow_and_data('craftEpisodeSubmit');
select pgflow.delete_flow_and_data('craftEpisodeDownload');

delete from pgflow.worker_functions
where function_name in (
  'craft-episode-worker',
  'craft-episode-download-worker',
  'download-monitor'
);

do $$
begin
  begin
    perform cron.unschedule('download_monitor_audio_generated');
  exception when others then
    null;
  end;
end;
$$;

drop function if exists public.invoke_download_monitor();

insert into podcast_config (key, value)
values ('pipeline.mode', '"events"'::jsonb)
on conflict (key) do update set value = excluded.value;

delete from podcast_config
where key in (
  'podcast.title',
  'podcast.description',
  'podcast.cover_url',
  'download.monitor_interval_seconds'
);
