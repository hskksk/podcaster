alter table episodes
  drop constraint if exists episodes_status_check;

alter table episodes
  add constraint episodes_status_check
  check (
    status in (
      'ingested',
      'script_running',
      'script_ready',
      'script_failed',
      'audio_running',
      'audio_ready',
      'audio_failed',
      'published',
      'rss_failed'
    )
  );
