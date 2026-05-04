import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Article, Episode, ProcessingLog } from '../data/types.js';
import { matchesTextFilter } from '../utils/text-filter.js';

const COL = {
  timestamp: 20,
  queue: 15,
  status: 10,
  duration: 10,
};

interface Props {
  logs: ProcessingLog[];
  episodes: Episode[];
  articles: Article[];
  columns: number;
  isFocused: boolean;
  rows: number;
  filterQuery: string;
  keyboardEnabled: boolean;
}

function formatLeft(timestamp: string, queue: string, status: string, duration: string, leftPad: boolean): string {
  const row = `${timestamp.padEnd(COL.timestamp)} │ ${queue.padEnd(COL.queue)} │ ${status.padEnd(COL.status)} │ ${duration.padEnd(COL.duration)}`;
  return leftPad ? ` ${row}` : row;
}

function resolveLogTitle(
  log: ProcessingLog,
  episodeTitle: Map<string, string>,
  articleTitle: Map<string, string>
): string {
  if (log.episode_id) {
    const t = episodeTitle.get(log.episode_id);
    if (t?.trim()) return t.trim();
    return `(episode ${log.episode_id.slice(0, 8)}…)`;
  }
  if (log.article_id) {
    const t = articleTitle.get(log.article_id);
    if (t?.trim()) return t.trim();
    return `(article ${log.article_id.slice(0, 8)}…)`;
  }
  return '—';
}

export const LogsView: React.FC<Props> = ({
  logs,
  episodes,
  articles,
  columns,
  isFocused,
  rows,
  filterQuery,
  keyboardEnabled
}) => {
  const [offset, setOffset] = useState(0);
  // top bar, table header, pager, borders/margins consume rows in this view.
  const limit = Math.max(5, rows - 13);

  const episodeTitle = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of episodes) m.set(e.id, e.title ?? '');
    return m;
  }, [episodes]);

  const articleTitle = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of articles) m.set(a.id, a.title ?? '');
    return m;
  }, [articles]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const title = resolveLogTitle(log, episodeTitle, articleTitle);
      return matchesTextFilter(filterQuery, [
        log.queue_name,
        log.status,
        log.error_message,
        log.episode_id,
        log.article_id,
        log.processed_at,
        new Date(log.processed_at).toISOString(),
        new Date(log.processed_at).toLocaleString(),
        log.duration_ms != null ? log.duration_ms : '',
        title
      ]);
    });
  }, [logs, filterQuery, episodeTitle, articleTitle]);

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
  /** Main pane width minus sidebar (22) and padding/border slack. */
  const rowInnerWidth = Math.max(48, columns - 22 - 6);

  return (
    <Box flexDirection="column" height="100%" width="100%" flexGrow={1} minWidth={0}>
      <Box borderStyle="single" justifyContent="center" flexShrink={0} borderColor={isFocused ? 'cyan' : 'gray'}>
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
          <Box flexDirection="row" width={rowInnerWidth}>
            <Text bold>{formatLeft('Timestamp', 'Queue', 'Status', 'Duration', false)}</Text>
            <Text bold color="gray">
              {' │ '}
            </Text>
            <Box minWidth={0} flexGrow={1}>
              <Text bold wrap="truncate-end">
                Title
              </Text>
            </Box>
          </Box>
        </Box>
        <Box flexDirection="column" flexGrow={1} overflowY="hidden">
          {visibleLogs.map((log, i) => {
            const statusColor = log.status === 'success' ? 'green' : 'red';
            const title = resolveLogTitle(log, episodeTitle, articleTitle);
            return (
              <Box key={i + offset} paddingX={1}>
                <Box flexDirection="row" width={rowInnerWidth}>
                  <Text color={statusColor}>
                    {formatLeft(
                      new Date(log.processed_at).toLocaleString(),
                      log.queue_name || '',
                      log.status || '',
                      log.duration_ms == null ? '-' : `${(log.duration_ms / 1000).toFixed(1)}s`,
                      true
                    )}
                  </Text>
                  <Text color="gray"> │ </Text>
                  <Box minWidth={0} flexGrow={1}>
                    <Text color="gray" wrap="truncate-end">
                      {title}
                    </Text>
                  </Box>
                </Box>
              </Box>
            );
          })}
          {filteredLogs.length === 0 && (
            <Text color="gray">{logs.length === 0 ? 'No logs found' : 'No logs match filter'}</Text>
          )}
        </Box>
        <Box justifyContent="center" flexShrink={0}>
          <Text color="gray">
            --- {offset + 1}-{offset + visibleLogs.length} of {filteredLogs.length} ---
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
