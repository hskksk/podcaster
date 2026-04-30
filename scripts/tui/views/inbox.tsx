import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { InboxFile } from '../data/types.js';
import { matchesTextFilter } from '../utils/text-filter.js';

interface Props {
  inbox: InboxFile[];
  draft: InboxFile[];
  filterQuery: string;
}

export const InboxView: React.FC<Props> = ({ inbox = [], draft = [], filterQuery }) => {
  const filteredInbox = useMemo(
    () =>
      inbox.filter(f =>
        matchesTextFilter(filterQuery, [f.name, f.size, new Date(f.mtime).toLocaleString()])
      ),
    [inbox, filterQuery]
  );

  const filteredDraft = useMemo(
    () =>
      draft.filter(f =>
        matchesTextFilter(filterQuery, [f.name, f.size, new Date(f.mtime).toLocaleString()])
      ),
    [draft, filterQuery]
  );

  const fq = filterQuery.trim();
  const matchHint = fq ? (
    <>
      <Text color="gray"> │ </Text>
      <Text dimColor>match: </Text>
      <Text color="magenta">{fq}</Text>
    </>
  ) : null;

  return (
    <Box flexDirection="row" height="100%" width="100%" flexGrow={1} minWidth={0}>
      <Box width="50%" minWidth={0} borderStyle="single" flexDirection="column">
        <Box borderStyle="single" justifyContent="center">
          <Text bold color="yellow">
            INBOX (Pending Ingest)
            {matchHint}
          </Text>
        </Box>
        <Box flexDirection="column" paddingX={1} marginTop={1}>
          {filteredInbox.map((f, i) => (
            <Box key={`${f.name}-${i}`} justifyContent="space-between">
              <Text>{f.name}</Text>
              <Text color="gray">{Math.round(f.size / 1024)} KB</Text>
            </Box>
          ))}
          {filteredInbox.length === 0 && (
            <Text color="gray">{inbox.length === 0 ? 'No files in inbox' : 'No inbox files match filter'}</Text>
          )}
        </Box>
      </Box>
      <Box flexGrow={1} minWidth={0} borderStyle="single" flexDirection="column">
        <Box borderStyle="single" justifyContent="center">
          <Text bold color="green">
            DRAFT (Ingested)
            {matchHint}
          </Text>
        </Box>
        <Box flexDirection="column" paddingX={1} marginTop={1}>
          {filteredDraft.map((f, i) => (
            <Box key={`${f.name}-d-${i}`} justifyContent="space-between">
              <Text>{f.name}</Text>
              <Text color="gray">{new Date(f.mtime).toLocaleDateString()}</Text>
            </Box>
          ))}
          {filteredDraft.length === 0 && (
            <Text color="gray">{draft.length === 0 ? 'No files in draft' : 'No draft files match filter'}</Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};
