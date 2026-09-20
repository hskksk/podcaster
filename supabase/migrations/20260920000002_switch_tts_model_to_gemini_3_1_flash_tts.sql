-- gemini-2.5-flash-preview-tts no longer supports batchGenerateContent (404 NOT_FOUND
-- from the Batch API), and the pipeline submits every episode as a batch job.
-- Move to gemini-3.1-flash-tts-preview, which does support batch.
--
-- The long-form volume fade that made us leave 3.1 (20260802000001,
-- google-gemini/cookbook#1292) is not fixed by wording the style prompt differently
-- (measured); the pipeline now splits the script into ~2 min chunks instead, one TTS
-- request per chunk in a single batch job (shared/tts-prompt.ts,
-- packages/gemini-batch-tts). Tunable via podcast_config `tts.chunk_max_chars`.
update podcast_config
set value = '"gemini-3.1-flash-tts-preview"'::jsonb
where key = 'tts.model'
  and value = '"gemini-2.5-flash-preview-tts"'::jsonb;
