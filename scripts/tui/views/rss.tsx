import React from 'react';
import { Box, Text } from 'ink';
import { Episode, PodcastConfig } from '../data/types.js';

interface Props {
  episodes: Episode[];
  config: PodcastConfig[];
}

export const RssView: React.FC<Props> = ({ episodes, config }) => {
  const title = config.find(c => c.key === 'podcast.title')?.value || 'Podcast';
  const published = episodes.filter(e => e.status === 'published');

  return (
    <Box flexDirection="column" height="100%" width="100%" flexGrow={1} minWidth={0}>
      <Box borderStyle="single" justifyContent="center">
        <Text bold>RSS FEED PREVIEW (feed.xml)</Text>
      </Box>
      <Box paddingX={1} marginTop={1} flexDirection="column">
        <Text color="gray">{`<?xml version="1.0" encoding="UTF-8"?>`}</Text>
        <Text color="gray">{`<rss version="2.0">`}</Text>
        <Text color="gray">{`  <channel>`}</Text>
        <Text color="cyan">{`    <title>${title}</title>`}</Text>
        {published.map(e => (
          <Box key={e.id} marginLeft={4} flexDirection="column">
            <Text color="yellow">{`    <item>`}</Text>
            <Text color="white">{`      <title>${e.title}</title>`}</Text>
            <Text color="yellow">{`    </item>`}</Text>
          </Box>
        ))}
        <Text color="gray">{`  </channel>`}</Text>
        <Text color="gray">{`</rss>`}</Text>
      </Box>
    </Box>
  );
};
