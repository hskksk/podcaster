-- Finer TTS chunking for Gemini 3.1 volume drift (see shared/tts-prompt.ts).
-- Do not overwrite environments that already set a custom value.
insert into podcast_config (key, value)
values ('tts.chunk_max_chars', '120'::jsonb)
on conflict (key) do nothing;
