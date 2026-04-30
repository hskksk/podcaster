import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  view: string;
  isMock: boolean;
  /** Global list filter; shown in the top bar when non-empty. Applies to all main list views. */
  filterQuery?: string;
}

export const TopBar: React.FC<Props> = ({ view, isMock, filterQuery = '' }) => {
  const fq = filterQuery.trim();
  const filterHint =
    fq.length > 0 ? (
      <>
        <Text color="gray"> │ </Text>
        <Text dimColor>filter </Text>
        <Text color="magenta" wrap="truncate-end">
          {fq.length > 36 ? `${fq.slice(0, 33)}…` : fq}
        </Text>
      </>
    ) : null;

  return (
    <Box paddingX={1} justifyContent="space-between" borderStyle="classic" borderColor="gray" height={3} flexShrink={0}>
      <Box>
        <Text color="cyan" bold>{view.toUpperCase()}</Text>
        <Text color="gray"> │ </Text>
        <Text color={isMock ? "yellow" : "green"}>{isMock ? "MOCK" : "REAL"}</Text>
        {filterHint}
      </Box>
      <Box>
        <Text color="gray">{new Date().toLocaleTimeString()}</Text>
      </Box>
    </Box>
  );
};
