-- Allow RSS feed uploads from events publish path (Content-Type: application/rss+xml).
-- Replaces 20261102100001 (never applied on remote; timestamp was before 20261102180001).

update storage.buckets
set allowed_mime_types = array_cat(
  coalesce(allowed_mime_types, array[]::text[]),
  array['application/rss+xml']::text[]
)
where id = 'podcast'
  and not ('application/rss+xml' = any (coalesce(allowed_mime_types, array[]::text[])));
