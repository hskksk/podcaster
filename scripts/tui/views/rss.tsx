import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Episode, PodcastConfig } from '../data/types.js';
import { matchesTextFilter } from '../utils/text-filter.js';

interface Props {
  episodes: Episode[];
  config: PodcastConfig[];
  filterQuery: string;
  isFocused: boolean;
  keyboardEnabled: boolean;
  rows: number;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const RssView: React.FC<Props> = ({
  episodes,
  config,
  filterQuery,
  isFocused,
  keyboardEnabled,
  rows
}) => {
  const [offset, setOffset] = useState(0);
  const title = config.find(c => c.key === 'podcast.title')?.value || 'Podcast';

  const filteredPublished = useMemo(() => {
    const published = episodes.filter(e => e.status === 'published');
    const fq = filterQuery.trim();
    if (!fq) return published;
    return published.filter(e =>
      matchesTextFilter(filterQuery, [
        e.id,
        e.title,
        e.status,
        e.created_at,
        e.article_id,
        e.mem_note_id
      ])
    );
  }, [episodes, filterQuery]);

  // prolog, channel open, title line, items area, channel/rss close ≈ 7 + items
  const limit = Math.max(2, rows - 16);

  useEffect(() => {
    setOffset(prev => Math.min(prev, Math.max(0, filteredPublished.length - limit)));
  }, [filteredPublished.length, limit]);

  useInput((input, key) => {
    if (!keyboardEnabled || !isFocused || filteredPublished.length === 0) return;
    if (key.downArrow || input === 'j') {
      setOffset(prev => Math.min(prev + 1, Math.max(0, filteredPublished.length - limit)));
    }
    if (key.upArrow || input === 'k') {
      setOffset(prev => Math.max(prev - 1, 0));
    }
  });

  const visible = filteredPublished.slice(offset, offset + limit);
  const fq = filterQuery.trim();

  return (
    <Box flexDirection="column" height="100%" width="100%" flexGrow={1} minWidth={0}>
      <Box
        borderStyle="single"
        justifyContent="center"
        flexShrink={0}
        borderColor={isFocused ? 'cyan' : 'gray'}
      >
        <Text bold>
          RSS FEED PREVIEW (feed.xml)
          {fq ? (
            <>
              <Text color="gray"> │ </Text>
              <Text dimColor>match: </Text>
              <Text color="magenta">{fq}</Text>
            </>
          ) : null}
          {keyboardEnabled && isFocused ? <Text color="gray"> (j/k)</Text> : null}
        </Text>
      </Box>
      <Box paddingX={1} marginTop={1} flexDirection="column" flexGrow={1}>
        <Text color="gray">{`<?xml version="1.0" encoding="UTF-8"?>`}</Text>
        <Text color="gray">{`<rss version="2.0">`}</Text>
        <Text color="gray">{`  <channel>`}</Text>
        <Text color="cyan">{`    <title>${escapeXml(String(title))}</title>`}</Text>
        {visible.map(e => (
          <Box key={e.id} marginLeft={4} flexDirection="column">
            <Text color="yellow">{`    <item>`}</Text>
            <Text color="white">{`      <title>${escapeXml(e.title)}</title>`}</Text>
            <Text color="yellow">{`    </item>`}</Text>
          </Box>
        ))}
        {filteredPublished.length === 0 && (
          <Box marginLeft={4}>
            <Text color="gray">
              {episodes.some(e => e.status === 'published')
                ? 'No published episodes match filter'
                : 'No published episodes'}
            </Text>
          </Box>
        )}
        <Text color="gray">{`  </channel>`}</Text>
        <Text color="gray">{`</rss>`}</Text>
        {filteredPublished.length > limit && (
          <Box marginTop={1} justifyContent="center">
            <Text color="gray">
              --- items {offset + 1}-{offset + visible.length} of {filteredPublished.length} ---
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
