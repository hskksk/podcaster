alter table audio_files
  drop column if exists callback_received_at,
  drop column if exists callback_payload;

delete from podcast_config
where key in (
  'gemini.webhook_callback_url',
  'gemini.webhook_jwks_path',
  'gemini.webhook_audience',
  'gemini.webhook_issuer'
);
