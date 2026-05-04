import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  value: string;
}

/** Inline filter bar; keys are handled in App.useInput while uiMode === 'filter'. */
export const FilterInput: React.FC<Props> = ({ value }) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="magenta"
      backgroundColor="black"
      paddingX={1}
      marginTop={1}
      alignSelf="stretch"
      width="100%"
    >
      <Text bold color="magenta">Filter</Text>
      {value.length > 0 ? (
        <Text color="white">{value}</Text>
      ) : (
        <Text dimColor>(empty matches all)</Text>
      )}
      <Text dimColor>Live filter (Pipeline, Episodes, Articles, Audio, Logs, Inbox, RSS, Config) │ Enter — Close │ Esc — Revert & close</Text>
    </Box>
  );
};
