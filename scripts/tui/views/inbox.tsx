import React from 'react';
import { Box, Text } from 'ink';
import { InboxFile } from '../data/types.js';

interface Props {
  inbox: InboxFile[];
  draft: InboxFile[];
}

export const InboxView: React.FC<Props> = ({ inbox = [], draft = [] }) => {
  return (
    <Box flexDirection="row" height="100%" width="100%" flexGrow={1} minWidth={0}>
      <Box width="50%" minWidth={0} borderStyle="single" flexDirection="column">
        <Box borderStyle="single" justifyContent="center">
          <Text bold color="yellow">INBOX (Pending Ingest)</Text>
        </Box>
        <Box flexDirection="column" paddingX={1} marginTop={1}>
          {inbox.map((f, i) => (
            <Box key={i} justifyContent="space-between">
              <Text>{f.name}</Text>
              <Text color="gray">{Math.round(f.size / 1024)} KB</Text>
            </Box>
          ))}
          {inbox.length === 0 && <Text color="gray">No files in inbox</Text>}
        </Box>
      </Box>
      <Box flexGrow={1} minWidth={0} borderStyle="single" flexDirection="column">
        <Box borderStyle="single" justifyContent="center">
          <Text bold color="green">DRAFT (Ingested)</Text>
        </Box>
        <Box flexDirection="column" paddingX={1} marginTop={1}>
          {draft.map((f, i) => (
            <Box key={i} justifyContent="space-between">
              <Text>{f.name}</Text>
              <Text color="gray">{new Date(f.mtime).toLocaleDateString()}</Text>
            </Box>
          ))}
          {draft.length === 0 && <Text color="gray">No files in draft</Text>}
        </Box>
      </Box>
    </Box>
  );
};
