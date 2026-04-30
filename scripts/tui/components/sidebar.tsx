import React from 'react';
import { Box, Text, useInput } from 'ink';

interface Props {
  currentView: string;
  onSelect: (view: string) => void;
  focus: boolean;
}

const VIEWS = [
  { key: 'pipeline', label: '1. Pipeline', glyph: '◫' },
  { key: 'episodes', label: '2. Episodes', glyph: '♪' },
  { key: 'articles', label: '3. Articles', glyph: '¶' },
  { key: 'audio',    label: '4. Audio',    glyph: '~' },
  { key: 'logs',     label: '5. Logs',     glyph: '$' },
  { key: 'inbox',    label: '6. Inbox',    glyph: '↘' },
  { key: 'config',   label: '7. Config',   glyph: '⚙' },
  { key: 'rss',      label: '8. RSS',      glyph: '⌘' },
];

export const Sidebar: React.FC<Props> = ({ currentView, onSelect, focus }) => {
  const currentIndex = VIEWS.findIndex(v => v.key === currentView);

  useInput((input, key) => {
    if (!focus) return;

    if (key.downArrow || input === 'j') {
      const nextIndex = (currentIndex + 1) % VIEWS.length;
      onSelect(VIEWS[nextIndex].key);
    }

    if (key.upArrow || input === 'k') {
      const nextIndex = (currentIndex - 1 + VIEWS.length) % VIEWS.length;
      onSelect(VIEWS[nextIndex].key);
    }
  });

  return (
    <Box flexDirection="column" width={20} borderStyle="single" borderColor={focus ? "cyan" : "gray"} height="100%">
      <Box paddingX={1} marginBottom={1} flexShrink={0} borderStyle="single" borderColor={focus ? "cyan" : "gray"}>
        <Text bold color={focus ? "cyan" : "white"}>
          podcaster {focus ? "●" : ""}
        </Text>
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        {VIEWS.map(v => (
          <Box key={v.key} paddingX={1}>
            <Text color={currentView === v.key ? "yellow" : "white"} bold={currentView === v.key}>
              {currentView === v.key ? "▸ " : "  "}{v.glyph} {v.label}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
