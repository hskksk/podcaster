import React from 'react';
import { Box, Text } from 'ink';
import { PodcastConfig } from '../data/types.js';

interface Props {
  config: PodcastConfig[];
}

export const ConfigView: React.FC<Props> = ({ config }) => {
  return (
    <Box flexDirection="column" height="100%" width="100%" flexGrow={1} minWidth={0}>
      <Box borderStyle="single" justifyContent="center">
        <Text bold>PODCAST CONFIG</Text>
      </Box>
      <Box flexDirection="column" paddingX={1} marginTop={1}>
        {config.map((item, i) => (
          <Box key={i} marginBottom={1}>
            <Text color="cyan" bold>{item.key.padEnd(25)}:</Text>
            <Box marginLeft={1}>
              <Text>{JSON.stringify(item.value)}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
