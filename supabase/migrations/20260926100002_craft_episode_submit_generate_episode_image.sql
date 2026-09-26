SELECT pgflow.add_step(
  'craftEpisodeSubmit',
  'generateEpisodeImage',
  ARRAY['generateScript'],
  max_attempts => 3,
  timeout => 180
);
