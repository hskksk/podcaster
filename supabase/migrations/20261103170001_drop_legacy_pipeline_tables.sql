-- Post Phase 6 soak: drop legacy pipeline tables; job logs only in attempt_log.

create or replace view jobs.attempt_log as
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

drop table if exists public.legacy_processing_logs;
drop table if exists public.legacy_scripts;
drop table if exists public.legacy_audio_files;
drop table if exists public.legacy_episodes;
drop table if exists public.legacy_articles;
