-- Pipeline snapshot identity for Git-sourced articles.
-- Knowledge lives in Git; these columns record which file/version was ingested.
-- Multiple NULLs are allowed (legacy rows). Unique violation → ingest 409.
alter table articles
  add column content_path text,
  add column content_sha text;

alter table articles
  add constraint articles_content_path_key unique (content_path);

comment on column articles.content_path is
  'Repo-relative Markdoc path, e.g. content/docs/{slug}/index.mdoc';
comment on column articles.content_sha is
  'SHA-256 of the ingested mdoc bytes at ingest time';
