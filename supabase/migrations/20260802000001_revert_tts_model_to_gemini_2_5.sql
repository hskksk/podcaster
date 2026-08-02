-- Revert TTS model from Gemini 3.1 to 2.5 for long-form audio stability.
-- See: https://github.com/google-gemini/cookbook/issues/1292
update podcast_config
set value = '"gemini-2.5-flash-preview-tts"'::jsonb
where key = 'tts.model'
  and value = '"gemini-3.1-flash-tts-preview"'::jsonb;
