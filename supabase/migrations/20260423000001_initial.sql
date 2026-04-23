-- articles: raw input content
create table articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  source_url text,
  source text default 'webhook',
  created_at timestamptz not null default now()
);

-- episodes: one per article, tracks pipeline state
create table episodes (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references articles(id) on delete set null,
  title text not null,
  description text not null,
  script text not null,
  audio_path text,
  status text not null default 'script_ready'
    check (status in ('script_ready', 'audio_ready', 'published', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

-- podcast_config: key-value store for podcast settings
create table podcast_config (
  key text primary key,
  value jsonb not null
);

-- Storage bucket for audio files and feed.xml
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'podcast', 'podcast', true, 104857600,  -- 100 MB
  array['audio/wav', 'audio/mpeg', 'audio/mp4', 'application/xml', 'text/xml', 'image/png', 'image/jpeg']
)
on conflict (id) do nothing;

-- Storage RLS: public read, service role write
create policy "public read podcast"
  on storage.objects for select
  using (bucket_id = 'podcast');

create policy "service role write podcast"
  on storage.objects for all
  using (bucket_id = 'podcast' and auth.role() = 'service_role');
