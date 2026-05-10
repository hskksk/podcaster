SELECT pgflow.create_flow('craftEpisodeSubmit', max_attempts => 3, base_delay => 5, timeout => 120);
SELECT pgflow.add_step('craftEpisodeSubmit', 'generateScript', max_attempts => 3, timeout => 180);
SELECT pgflow.add_step('craftEpisodeSubmit', 'generateAudioStart', ARRAY['generateScript'], max_attempts => 3, timeout => 60);
