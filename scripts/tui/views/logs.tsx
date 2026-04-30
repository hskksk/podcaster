import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ProcessingLog } from '../data/types.js';
import { matchesTextFilter } from '../utils/text-filter.js';

const COL = {
  timestamp: 20,
  queue: 15,
  status: 10,
  duration: 10,
};

interface Props {
  logs: ProcessingLog[];
  isFocused: boolean;
  rows: number;
  filterQuery: string;
  keyboardEnabled: boolean;
}

function formatRow(timestamp: string, queue: string, status: string, duration: string, leftPad: boolean = false): string {
  const row = `${timestamp.padEnd(COL.timestamp)} │ ${queue.padEnd(COL.queue)} │ ${status.padEnd(COL.status)} │ ${duration.padEnd(COL.duration)}`;
  return leftPad ? ` ${row}` : row;
}

export const LogsView: React.FC<Props> = ({ logs, isFocused, rows, filterQuery, keyboardEnabled }) => {
  const [offset, setOffset] = useState(0);
  // top bar, table header, pager, borders/margins consume rows in this view.
  const limit = Math.max(5, rows - 13);

  const filteredLogs = useMemo(() => {
    return logs.filter(log =>
      matchesTextFilter(filterQuery, [
        log.queue_name,
        log.status,
        log.error_message,
        log.episode_id,
        log.processed_at,
        new Date(log.processed_at).toISOString(),
        new Date(log.processed_at).toLocaleString(),
        log.duration_ms != null ? log.duration_ms : ''
      ])
    );
  }, [logs, filterQuery]);

  useEffect(() => {
    setOffset(prev => Math.min(prev, Math.max(0, filteredLogs.length - limit)));
  }, [filteredLogs.length, limit]);

  useInput((input, key) => {
    if (!keyboardEnabled || !isFocused) return;
    if (key.downArrow || input === 'j') {
      setOffset(prev => Math.min(prev + 1, Math.max(0, filteredLogs.length - limit)));
    }
    if (key.upArrow || input === 'k') {
      setOffset(prev => Math.max(prev - 1, 0));
    }
  });

  const visibleLogs = filteredLogs.slice(offset, offset + limit);

  return (
    <Box flexDirection="column" height="100%" width="100%" flexGrow={1} minWidth={0}>
      <Box borderStyle="single" justifyContent="center" flexShrink={0} borderColor={isFocused ? "cyan" : "gray"}>
        <Text bold>
          PROCESSING LOGS
          {filterQuery.trim() ? (
            <>
              <Text color="gray"> │ </Text>
              <Text dimColor>match: </Text>
              <Text color="magenta">{filterQuery.trim()}</Text>
            </>
          ) : null}
          {isFocused ? <Text color="gray"> (j/k)</Text> : null}
        </Text>
      </Box>
      <Box flexDirection="column" paddingX={1} marginTop={1} flexGrow={1}>
        <Box borderStyle="single" borderColor="gray" paddingX={1} flexShrink={0}>
          <Text bold>
            {formatRow('Timestamp', 'Queue', 'Status', 'Duration')}
          </Text>
        </Box>
        <Box flexDirection="column" flexGrow={1} overflowY="hidden">
          {visibleLogs.map((log, i) => (
            <Box key={i + offset} paddingX={1}>
              <Text color={log.status === 'success' ? 'green' : 'red'}>
                {formatRow(
                  new Date(log.processed_at).toLocaleString(),
                  log.queue_name || '',
                  log.status || '',
                  log.duration_ms == null ? '-' : `${(log.duration_ms / 1000).toFixed(1)}s`,
                  true
                )}
              </Text>
            </Box>
          ))}
          {filteredLogs.length === 0 && (
            <Text color="gray">{logs.length === 0 ? 'No logs found' : 'No logs match filter'}</Text>
          )}
        </Box>
        <Box justifyContent="center" flexShrink={0}>
          <Text color="gray">--- {offset + 1}-{offset + visibleLogs.length} of {filteredLogs.length} ---</Text>
        </Box>
      </Box>
    </Box>
  );
};
