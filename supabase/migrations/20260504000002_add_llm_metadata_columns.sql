-- Store model usage and raw provider response for later JSONB analysis.
alter table scripts
  add column llm_usage jsonb not null default '{}'::jsonb,
  add column llm_response jsonb;

alter table audio_files
  add column llm_usage jsonb not null default '{}'::jsonb,
  add column llm_response jsonb;
