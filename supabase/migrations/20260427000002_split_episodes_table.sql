-- Add mem_note_id to episodes (denormalized from articles for easy querying)
alter table episodes add column mem_note_id text;

-- scripts: conversation script lifecycle
create table scripts (
  id          uuid primary key default gen_random_uuid(),
  episode_id  uuid not null references episodes(id) on delete cascade,
  content     text not null,
  status      text not null default 'pending'
                check (status in ('pending', 'ready', 'failed')),
  error       text,
  created_at  timestamptz not null default now()
);

-- audio_files: audio file lifecycle
create table audio_files (
  id           uuid primary key default gen_random_uuid(),
  episode_id   uuid not null references episodes(id) on delete cascade,
  script_id    uuid references scripts(id) on delete set null,
  storage_path text not null,
  mime_type    text not null,
  status       text not null default 'pending'
                 check (status in ('pending', 'ready', 'failed')),
  error        text,
  created_at   timestamptz not null default now()
);

-- Migrate existing episodes.script → scripts
insert into scripts (episode_id, content, status, error, created_at)
select
  id,
  script,
  case when status = 'failed' then 'failed' else 'ready' end,
  error,
  created_at
from episodes
where script <> '';

-- Migrate existing episodes.audio_path → audio_files
insert into audio_files (episode_id, script_id, storage_path, mime_type, status, created_at)
select
  e.id,
  s.id,
  e.audio_path,
  case
    when e.audio_path like '%.m4a' then 'audio/mp4'
    when e.audio_path like '%.mp3' then 'audio/mpeg'
    else 'audio/wav'
  end,
  'ready',
  e.created_at
from episodes e
join scripts s on s.episode_id = e.id
where e.audio_path is not null;

-- Drop migrated columns
alter table episodes drop column script;
alter table episodes drop column audio_path;
alter table episodes drop column error;
