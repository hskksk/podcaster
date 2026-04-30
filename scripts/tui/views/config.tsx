import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { PodcastConfig } from '../data/types.js';
import { matchesTextFilter } from '../utils/text-filter.js';

interface Props {
  config: PodcastConfig[];
  filterQuery: string;
}

export const ConfigView: React.FC<Props> = ({ config, filterQuery }) => {
  const filtered = useMemo(
    () =>
      config.filter(c =>
        matchesTextFilter(filterQuery, [c.key, typeof c.value === 'string' ? c.value : JSON.stringify(c.value)])
      ),
    [config, filterQuery]
  );

  const fq = filterQuery.trim();

  return (
    <Box flexDirection="column" height="100%" width="100%" flexGrow={1} minWidth={0}>
      <Box borderStyle="single" justifyContent="center">
        <Text bold>
          PODCAST CONFIG
          {fq ? (
            <>
              <Text color="gray"> │ </Text>
              <Text dimColor>match: </Text>
              <Text color="magenta">{fq}</Text>
            </>
          ) : null}
        </Text>
      </Box>
      <Box flexDirection="column" paddingX={1} marginTop={1}>
        {filtered.map((item, i) => (
          <Box key={item.key + String(i)} marginBottom={1}>
            <Text color="cyan" bold>{item.key.padEnd(25)}:</Text>
            <Box marginLeft={1}>
              <Text>{JSON.stringify(item.value)}</Text>
            </Box>
          </Box>
        ))}
        {filtered.length === 0 && (
          <Text color="gray">{config.length === 0 ? 'No config entries' : 'No config entries match filter'}</Text>
        )}
      </Box>
    </Box>
  );
};
