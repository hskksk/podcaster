-- Align podcast_config with 200-char default (~30 s at ~7 chars/s Japanese).
-- Only bump the value introduced at 120; leave custom settings untouched.
update podcast_config
set value = '200'::jsonb
where key = 'tts.chunk_max_chars'
  and value = '120'::jsonb;

insert into podcast_config (key, value)
values ('tts.chunk_max_chars', '200'::jsonb)
on conflict (key) do nothing;
