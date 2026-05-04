import React from 'react';
import { Box, Text } from 'ink';

export const HelpModal: React.FC = () => {
  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="cyan"
      backgroundColor="black"
      paddingX={1}
      marginTop={1}
      alignSelf="stretch"
      width="100%"
    >
      <Text bold color="cyan">Keyboard shortcuts</Text>
      <Text color="gray">Esc — Close overlay</Text>
      <Box marginTop={1} flexDirection="column">
        <Text><Text bold color="white">1–8</Text> — Switch view</Text>
        <Text><Text bold color="white">h / l</Text> — Focus panes (← / →)</Text>
        <Text><Text bold color="white">j / k</Text> — Scroll lists / detail (when focused)</Text>
        <Text><Text bold color="white">r</Text> — Reload data</Text>
        <Text><Text bold color="white">q</Text> — Quit</Text>
        <Text><Text bold color="white">/</Text> — Global filter (Pipeline, Episodes, Articles, Audio, Logs, Inbox, RSS, Config; live)</Text>
        <Text><Text bold color="white">:</Text> — Command palette (↑/↓, type to narrow, Enter)</Text>
        <Text><Text bold color="white">?</Text> — This help</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold color="cyan">Data actions (confirm + toast)</Text>
        <Text dimColor>Pipeline (lane focused): Ctrl+A — Requeue audio for selected card</Text>
        <Text dimColor>Episodes (detail): p play / s stop / Ctrl+S script / Ctrl+A audio / Ctrl+Y rss / Ctrl+D download</Text>
        <Text dimColor>Audio (main focused): i detail │ p play │ s stop │ Ctrl+D download │ Ctrl+A requeue</Text>
        <Text dimColor>Inbox (list): i = mem-ai from ./inbox|articles file + ingest │ h/l / arrows │ Tab │ j/k</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Commands: reload │ target local │ target remote │ demo confirm (see palette with :)</Text>
      </Box>
    </Box>
  );
};
