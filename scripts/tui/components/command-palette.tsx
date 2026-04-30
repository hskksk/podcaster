import React from 'react';
import { Box, Text } from 'ink';
import { filterPaletteCommands } from '../commands/registry.js';

interface Props {
  draft: string;
  selectedIndex: number;
}

/** Command palette: type to narrow the list; j/k or arrows move selection; Enter runs selected (or typed line if list empty). */
export const CommandPalette: React.FC<Props> = ({ draft, selectedIndex }) => {
  const filtered = filterPaletteCommands(draft);
  const maxIdx = Math.max(0, filtered.length - 1);
  const sel = filtered.length > 0 ? Math.min(selectedIndex, maxIdx) : 0;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue" paddingX={1} marginTop={1} alignSelf="stretch">
      <Text bold color="blue">Command</Text>
      <Text color="white">:{draft}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor bold>
          {filtered.length > 0 ? 'Matching commands' : 'No command matches — Enter runs typed line'}
        </Text>
        {filtered.map((c, i) => {
          const active = i === sel;
          return (
            <Box key={c.id} flexDirection="row">
              <Text color={active ? 'yellow' : 'gray'}>{active ? '▸ ' : '  '}</Text>
              <Text bold color={active ? 'yellow' : 'white'}>
                {c.id}
              </Text>
              <Text color="gray"> — </Text>
              <Text dimColor wrap="truncate-end">
                {c.description}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>↑/↓ — Move selection │ Enter — Run highlighted (or typed line if none) │ Esc — Cancel</Text>
      </Box>
    </Box>
  );
};
