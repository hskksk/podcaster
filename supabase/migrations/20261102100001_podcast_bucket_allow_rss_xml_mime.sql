-- Allow RSS feed uploads from events publish path (Content-Type: application/rss+xml).

update storage.buckets
set allowed_mime_types = array_cat(
  coalesce(allowed_mime_types, array[]::text[]),
  array['application/rss+xml']::text[]
)
where id = 'podcast'
  and not ('application/rss+xml' = any (coalesce(allowed_mime_types, array[]::text[])));
