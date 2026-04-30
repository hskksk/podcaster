import React from 'react';
import { Box, Text } from 'ink';

export type ToastTone = 'info' | 'success' | 'error';

interface Props {
  message: string;
  tone: ToastTone;
}

export const Toast: React.FC<Props> = ({ message, tone }) => {
  const color = tone === 'success' ? 'green' : tone === 'error' ? 'red' : 'cyan';
  return (
    <Box paddingX={1} flexShrink={0}>
      <Text bold color={color}>{message}</Text>
    </Box>
  );
};
