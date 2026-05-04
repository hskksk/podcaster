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

  // Each item now uses 5 lines (<item>, <title>, text, </title>, </item>).
  // Calculate how many items can fit in the panel height.
  const itemLines = 5;
  const reservedLines = 16;
  const itemLimit = Math.max(1, Math.floor((rows - reservedLines) / itemLines));

  useEffect(() => {
    setOffset(prev => Math.min(prev, Math.max(0, filteredPublished.length - itemLimit)));
  }, [filteredPublished.length, itemLimit]);

  useInput((input, key) => {
    if (!keyboardEnabled || !isFocused || filteredPublished.length === 0) return;
    if (key.downArrow || input === 'j') {
      setOffset(prev => Math.min(prev + 1, Math.max(0, filteredPublished.length - itemLimit)));
    }
    if (key.upArrow || input === 'k') {
      setOffset(prev => Math.max(prev - 1, 0));
    }
  });

  const visible = filteredPublished.slice(offset, offset + itemLimit);
  const fq = filterQuery.trim();
  const channelTitle = escapeXml(String(title));

  const previewXmlLines: Array<{
    key: string;
    text: string;
    color: 'gray' | 'cyan' | 'yellow' | 'white' | 'magenta';
  }> = [
    { key: 'xml-prolog', text: '<?xml version="1.0" encoding="UTF-8"?>', color: 'gray' },
    { key: 'rss-open', text: '<rss version="2.0">', color: 'gray' },
    { key: 'channel-open', text: '  <channel>', color: 'gray' },
    { key: 'channel-title-open', text: '    <title>', color: 'cyan' },
    { key: 'channel-title-text', text: `      ${channelTitle}`, color: 'white' },
    { key: 'channel-title-close', text: '    </title>', color: 'cyan' }
  ];

  visible.forEach(episode => {
    const tagColor: 'yellow' = 'yellow';
    const titleColor: 'white' = 'white';

    previewXmlLines.push({ key: `item-open-${episode.id}`, text: '    <item>', color: tagColor });
    const escapedEpisodeTitle = escapeXml(episode.title);
    previewXmlLines.push({ key: `item-title-open-${episode.id}`, text: '      <title>', color: titleColor });
    previewXmlLines.push({
      key: `item-title-text-${episode.id}`,
      text: `        ${escapedEpisodeTitle}`,
      color: titleColor
    });
    previewXmlLines.push({ key: `item-title-close-${episode.id}`, text: '      </title>', color: titleColor });
    previewXmlLines.push({ key: `item-close-${episode.id}`, text: '    </item>', color: tagColor });
  });

  if (filteredPublished.length === 0) {
    const noPublishedMessage = episodes.some(e => e.status === 'published')
      ? 'No published episodes match filter'
      : 'No published episodes';
    previewXmlLines.push({
      key: 'empty-comment',
      text: `    <!-- ${noPublishedMessage} -->`,
      color: 'gray'
    });
  }

  previewXmlLines.push({ key: 'channel-close', text: '  </channel>', color: 'gray' });
  previewXmlLines.push({ key: 'rss-close', text: '</rss>', color: 'gray' });

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
      <Box paddingX={1} marginTop={1} flexDirection="column" flexGrow={1} overflowY="hidden">
        {previewXmlLines.map(line => (
          <Box key={line.key} flexShrink={0}>
            <Text color={line.color}>{line.text}</Text>
          </Box>
        ))}
        {filteredPublished.length > itemLimit && (
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
