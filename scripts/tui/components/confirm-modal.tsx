import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  title: string;
  message: string;
  readOnly?: boolean;
}

export const ConfirmModal: React.FC<Props> = ({ title, message, readOnly }) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      backgroundColor="black"
      paddingX={1}
      marginTop={1}
      alignSelf="stretch"
      width="100%"
    >
      <Text bold color="yellow">{title}</Text>
      <Text>{message}</Text>
      <Box marginTop={1}>
        <Text dimColor>
          {readOnly ? 'Enter / Esc — Close' : 'Enter — Confirm │ Esc — Cancel'}
        </Text>
      </Box>
    </Box>
  );
};
