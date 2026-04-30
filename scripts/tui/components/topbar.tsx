import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  view: string;
  isMock: boolean;
}

export const TopBar: React.FC<Props> = ({ view, isMock }) => {
  return (
    <Box paddingX={1} justifyContent="space-between" borderStyle="classic" borderColor="gray" height={3} flexShrink={0}>
      <Box>
        <Text color="cyan" bold>{view.toUpperCase()}</Text>
        <Text color="gray"> │ </Text>
        <Text color={isMock ? "yellow" : "green"}>{isMock ? "MOCK" : "REAL"}</Text>
      </Box>
      <Box>
        <Text color="gray">{new Date().toLocaleTimeString()}</Text>
      </Box>
    </Box>
  );
};
