-- Ingested episodes have no script/revision yet; show latest article revision title.

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
),
latest_article_rev as (
  select distinct on (ar.article_id)
    ar.article_id,
    ar.title,
    ar.content
  from podcast.article_revisions ar
  order by ar.article_id, ar.registered_at desc
)
select
  e.id,
  e.article_id,
  pa.mem_note_id,
  left(coalesce(lr.title, ls.title, lar.title, 'Untitled'), 20) as title,
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
left join latest_article_rev lar on lar.article_id = e.article_id
left join latest_rev lr on lr.episode_id = e.id
left join active_pub ap on ap.episode_id = e.id
left join latest_prod lp on lp.episode_id = e.id
left join latest_script ls on ls.production_id = lp.production_id
left join latest_audio la on la.production_id = lp.production_id
left join latest_art lart on lart.production_id = lp.production_id;
