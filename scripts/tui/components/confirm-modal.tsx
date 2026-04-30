import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  title: string;
  message: string;
}

export const ConfirmModal: React.FC<Props> = ({ title, message }) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      marginTop={1}
      alignSelf="stretch"
    >
      <Text bold color="yellow">{title}</Text>
      <Text>{message}</Text>
      <Box marginTop={1}>
        <Text dimColor>Enter — Confirm │ Esc — Cancel</Text>
      </Box>
    </Box>
  );
};
