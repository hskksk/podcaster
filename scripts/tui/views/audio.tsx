import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { AudioFile } from '../data/types.js';
import { matchesTextFilter } from '../utils/text-filter.js';

interface Props {
  audioFiles: AudioFile[];
  isFocused: boolean;
  columns: number;
  keyboardEnabled: boolean;
  filterQuery: string;
}

export const AudioView: React.FC<Props> = ({ audioFiles, isFocused, columns, keyboardEnabled, filterQuery }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const filteredFiles = useMemo(
    () =>
      audioFiles.filter(af =>
        matchesTextFilter(filterQuery, [
          af.id,
          af.episode_id,
          af.storage_path,
          af.mime_type,
          af.status,
          af.error,
          af.created_at
        ])
      ),
    [audioFiles, filterQuery]
  );

  const cardsPerRow = useMemo(() => {
    const sidebarWidth = 22;
    const mainWidth = Math.max(20, columns - sidebarWidth);
    const cardOuterWidth = 42;
    return Math.max(1, Math.floor(mainWidth / cardOuterWidth));
  }, [columns]);

  useEffect(() => {
    if (filteredFiles.length === 0) {
      setSelectedIndex(null);
      return;
    }
    if (!isFocused) return;
    setSelectedIndex(prev => {
      if (prev == null) return 0;
      return Math.min(prev, filteredFiles.length - 1);
    });
  }, [filteredFiles.length, isFocused]);

  useInput((input, key) => {
    if (!keyboardEnabled || !isFocused || filteredFiles.length === 0) return;
    if (selectedIndex == null) return;

    const maxIndex = filteredFiles.length - 1;
    let next = selectedIndex;

    if (key.leftArrow || input === 'h') next = selectedIndex - 1;
    if (key.rightArrow || input === 'l') next = selectedIndex + 1;
    if (key.downArrow || input === 'j') next = selectedIndex + cardsPerRow;
    if (key.upArrow || input === 'k') next = selectedIndex - cardsPerRow;

    if (next !== selectedIndex) {
      setSelectedIndex(Math.max(0, Math.min(maxIndex, next)));
    }
  });

  const fq = filterQuery.trim();

  return (
    <Box flexDirection="column" height="100%" width="100%" flexGrow={1} minWidth={0}>
      <Box borderStyle="single" justifyContent="center" borderColor={isFocused ? 'cyan' : 'gray'}>
        <Text bold>
          AUDIO FILES
          {fq ? (
            <>
              <Text color="gray"> │ </Text>
              <Text dimColor>match: </Text>
              <Text color="magenta">{fq}</Text>
            </>
          ) : null}
        </Text>
      </Box>
      <Box flexDirection="row" flexWrap="wrap" paddingX={1} marginTop={1}>
        {filteredFiles.map((af, i) => (
          <Box
            key={af.id}
            borderStyle="single"
            borderColor={isFocused && selectedIndex === i ? 'yellow' : 'gray'}
            margin={1}
            paddingX={1}
            width={40}
          >
            <Box flexDirection="column">
              <Text bold color="yellow">{af.storage_path.split('/').pop()}</Text>
              <Text color="gray">ID: {af.id.slice(0, 8)}</Text>
              <Text color="gray">Type: {af.mime_type}</Text>
              <Text color="gray">Status: {af.status}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
