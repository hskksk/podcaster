alter table articles
  add column ingest_route text,
  add column ingest_meta  jsonb;

create index articles_ingest_route_idx on articles (ingest_route)
  where ingest_route is not null;
