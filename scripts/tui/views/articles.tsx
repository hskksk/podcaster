import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { Article } from '../data/types.js';
import { MarkdownRenderer } from '../components/markdown-renderer.js';
import { matchesTextFilter } from '../utils/text-filter.js';

interface Props {
  articles: Article[];
  focus: 'sidebar' | 'list' | 'detail';
  rows: number;
  columns: number;
  filterQuery: string;
  keyboardEnabled: boolean;
}

export const ArticlesView: React.FC<Props> = ({
  articles,
  focus,
  rows,
  columns,
  filterQuery,
  keyboardEnabled
}) => {
  const filteredArticles = useMemo(() => {
    return articles.filter(a =>
      matchesTextFilter(filterQuery, [a.title, a.source, a.id, a.mem_note_id])
    );
  }, [articles, filterQuery]);

  const [selectedId, setSelectedId] = useState<string | null>(articles[0]?.id || null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [renderedLineCount, setRenderedLineCount] = useState(0);

  useEffect(() => {
    if (filteredArticles.some(a => a.id === selectedId)) return;
    setSelectedId(filteredArticles[0]?.id ?? null);
    setScrollOffset(0);
  }, [filteredArticles, selectedId]);

  const selectedArticle = filteredArticles.find(a => a.id === selectedId);
  const previewWidth = useMemo(() => {
    const sidebarWidth = 22;
    const listPaneRatio = 0.3;
    const rightPaneRatio = 1 - listPaneRatio;
    const mainWidth = Math.max(20, columns - sidebarWidth);
    const rightPaneWidth = Math.max(10, Math.floor(mainWidth * rightPaneRatio));
    // right pane border/padding/header margins consume several columns.
    return Math.max(3, rightPaneWidth - 6);
  }, [columns]);

  // Calculate limit precisely: rows - topbar(3) - footer(1) - header(3) - borders(2) - spacing(2)
  const limit = Math.max(5, rows - 11);

  useEffect(() => {
    setScrollOffset(prev => Math.min(prev, Math.max(0, renderedLineCount - limit)));
  }, [renderedLineCount, limit]);

  useInput((input, key) => {
    if (!keyboardEnabled || focus !== 'detail') return;

    if (key.downArrow || input === 'j') {
      setScrollOffset(prev => Math.min(prev + 1, Math.max(0, renderedLineCount - limit)));
    }
    if (key.upArrow || input === 'k') {
      setScrollOffset(prev => Math.max(0, prev - 1));
    }
  });

  const items = filteredArticles.map(a => ({
    label: `${(a.source || 'mem').padEnd(8)} │ ${a.title}`,
    value: a.id
  }));
  const listLimit = Math.max(5, rows - 10);

  const visibleEnd = Math.min(scrollOffset + limit, renderedLineCount);

  const renderItem = (item: any, isSelected: boolean) => (
    <Text color={isSelected ? "yellow" : "white"} wrap="truncate-end">
      {isSelected ? "▸ " : "  "}{item.label}
    </Text>
  );

  return (
    <Box flexDirection="row" height="100%" width="100%" flexGrow={1} minWidth={0}>
      <Box width="30%" borderStyle="single" flexDirection="column" borderColor={focus === 'list' ? "cyan" : "gray"} flexShrink={0}>
        <Box borderStyle="single" justifyContent="center" flexShrink={0} borderColor={focus === 'list' ? "cyan" : "gray"}>
          <Text bold color={focus === 'list' ? "cyan" : "white"}>
            ARTICLES
            {filterQuery.trim() ? (
              <>
                <Text color="gray"> │ </Text>
                <Text dimColor>match: </Text>
                <Text color="magenta">{filterQuery.trim()}</Text>
              </>
            ) : null}
            {focus === 'list' ? ' ●' : ''}
          </Text>
        </Box>
        <Box paddingX={1} flexGrow={1} overflowY="hidden">
          {focus === 'list' && keyboardEnabled ? (
            items.length > 0 ? (
              <SelectInput
                items={items}
                limit={listLimit}
                onHighlight={(item) => {
                  setSelectedId(item.value);
                  setScrollOffset(0);
                }}
                onSelect={(item) => {
                  setSelectedId(item.value);
                  setScrollOffset(0);
                }}
                indicatorComponent={() => null}
                itemComponent={({ label, isSelected }) => renderItem({ label }, isSelected)}
              />
            ) : (
              <Text color="gray">No articles match filter</Text>
            )
          ) : (
            <Box flexDirection="column">
              {items.slice(0, listLimit).map(item => (
                <Box key={item.value}>
                  {renderItem(item, item.value === selectedId)}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
      <Box flexGrow={1} minWidth={0} borderStyle="single" paddingX={1} flexDirection="column" borderColor={focus === 'detail' ? "cyan" : "gray"}>
        <Box borderStyle="single" justifyContent="center" flexShrink={0} borderColor={focus === 'detail' ? "cyan" : "gray"}>
          <Text bold color={focus === 'detail' ? "cyan" : "white"}>PREVIEW {focus === 'detail' ? "● (j/k scroll)" : ""}</Text>
        </Box>
        {selectedArticle ? (
          <Box flexDirection="column" marginTop={1} flexGrow={1} overflowY="hidden">
            <Text bold color="cyan" underline wrap="truncate-end">{selectedArticle.title}</Text>
            <Box marginTop={1} flexDirection="column" flexGrow={1} overflowY="hidden">
              <MarkdownRenderer
                markdown={selectedArticle.content}
                width={previewWidth}
                scrollOffset={scrollOffset}
                lineLimit={limit}
                onLineCountChange={setRenderedLineCount}
              />
            </Box>
            {renderedLineCount > limit && (
              <Box marginTop={1} flexShrink={0}>
                <Text color="gray italic">--- {scrollOffset + 1}-{visibleEnd} of {renderedLineCount} ---</Text>
              </Box>
            )}
          </Box>
        ) : (
          <Box flexGrow={1} justifyContent="center" alignItems="center">
            <Text color="gray">Select an article</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
