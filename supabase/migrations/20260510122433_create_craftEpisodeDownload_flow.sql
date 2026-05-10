SELECT pgflow.create_flow('craftEpisodeDownload', max_attempts => 1, base_delay => 5, timeout => 120);
SELECT pgflow.add_step('craftEpisodeDownload', 'generateAudioDownload', max_attempts => 1, timeout => 120);
SELECT pgflow.add_step('craftEpisodeDownload', 'updateRss', ARRAY['generateAudioDownload'], max_attempts => 3, timeout => 120);
