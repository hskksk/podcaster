import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { Episode, Script, PodcastConfig } from '../data/types.js';
import { DataClient } from '../data/client.js';

interface Props {
  episodes: Episode[];
  config: PodcastConfig[];
  focus: 'sidebar' | 'list' | 'detail';
  client: DataClient;
  rows: number;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
}

export const EpisodesView: React.FC<Props> = ({ episodes, config, focus, client, rows, selectedId, onSelectId }) => {
  const [script, setScript] = useState<Script | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  const hostName = config.find(c => c.key === 'tts.host.name')?.value || 'Host';
  const cohostName = config.find(c => c.key === 'tts.cohost.name')?.value || 'CoHost';

  const limit = Math.max(5, rows - 15);

  useEffect(() => {
    if (selectedId) {
      setScript(null);
      setScrollOffset(0);
      client.fetchScript(selectedId).then(setScript);
    }
  }, [selectedId]);

  useInput((input, key) => {
    if (focus !== 'detail') return;

    if (key.downArrow || input === 'j') {
      setScrollOffset(prev => prev + 1);
    }
    if (key.upArrow || input === 'k') {
      setScrollOffset(prev => Math.max(0, prev - 1));
    }
  });

  const items = episodes.map(e => ({
    label: `${e.status.padEnd(9)} │ ${e.title}`,
    value: e.id
  }));

  const selectedEpisode = episodes.find(e => e.id === selectedId);
  const scriptLines = script ? parseScript(script.content, hostName, cohostName) : [];
  const visibleScript = scriptLines.slice(scrollOffset, scrollOffset + limit);

  const renderItem = (item: any, isSelected: boolean) => (
    <Text color={isSelected ? "yellow" : "white"} wrap="truncate-end">
      {isSelected ? "▸ " : "  "}{item.label}
    </Text>
  );

  return (
    <Box flexDirection="row" height="100%" width="100%" flexGrow={1} minWidth={0}>
      <Box width="35%" borderStyle="single" flexDirection="column" borderColor={focus === 'list' ? "cyan" : "gray"} flexShrink={0}>
        <Box borderStyle="single" justifyContent="center" flexShrink={0} borderColor={focus === 'list' ? "cyan" : "gray"}>
          <Text bold color={focus === 'list' ? "cyan" : "white"}>EPISODES {focus === 'list' ? "●" : ""}</Text>
        </Box>
        <Box paddingX={1} flexGrow={1} overflowY="hidden">
          {focus === 'list' ? (
            <SelectInput
              items={items}
              limit={Math.max(5, rows - 10)}
              onHighlight={(item) => onSelectId(item.value)}
              onSelect={(item) => onSelectId(item.value)}
              initialIndex={episodes.findIndex(e => e.id === selectedId)}
              indicatorComponent={() => null} // Hide default indicator
              itemComponent={({ label, isSelected }) => renderItem({ label }, isSelected)}
            />
          ) : (
              <Box flexDirection="column">
                {items.slice(0, limit).map(item => (
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
          <Text bold color={focus === 'detail' ? "cyan" : "white"}>DETAIL {focus === 'detail' ? "● (j/k scroll)" : ""}</Text>
        </Box>
        {selectedEpisode ? (
          <Box flexDirection="column" marginTop={1} flexGrow={1} overflowY="hidden">
            <Box flexShrink={0}>
              <Text bold color="yellow" wrap="truncate-end">{selectedEpisode.title}</Text>
            </Box>
            <Box flexShrink={0}>
              <Text color="gray">Status: {selectedEpisode.status} │ Created: {new Date(selectedEpisode.created_at).toLocaleDateString()}</Text>
            </Box>

            <Box marginTop={1} flexDirection="column" flexGrow={1} minHeight={0} overflowY="hidden">
              {script ? (
                <Box flexDirection="column" flexGrow={1} minHeight={0} overflowY="hidden">
                  {visibleScript.map((line: any, i: number) => (
                    <Box key={i} flexDirection="column" flexShrink={0}>
                      {/* flex-start width = label content so Ink does not hard-wrap "Host:" across lines */}
                      <Box alignSelf="flex-start" flexShrink={0}>
                        <Text bold color={line.speaker.toLowerCase() === 'host' ? 'blue' : 'magenta'}>
                          {line.speaker}:
                        </Text>
                      </Box>
                      <Box marginLeft={2} flexShrink={0}>
                        <Text>{line.text}</Text>
                      </Box>
                    </Box>
                  ))}
                  {scriptLines.length > limit && (
                    <Box marginTop={1}>
                      <Text color="gray italic">--- {scrollOffset + 1}-{scrollOffset + visibleScript.length} of {scriptLines.length} ---</Text>
                    </Box>
                  )}
                </Box>
              ) : (
                  <Text color="gray italic">Loading script...</Text>
                )}
            </Box>
          </Box>
        ) : (
            <Box flexGrow={1} justifyContent="center" alignItems="center">
              <Text color="gray">Select an episode</Text>
            </Box>
          )}
      </Box>
    </Box>
  );
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeForTerminal(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function toScriptLine(raw: any): { speaker: string; text: string } {
  const speaker = normalizeForTerminal(String(raw?.speaker ?? '?')).trim() || '?';
  const text = normalizeForTerminal(String(raw?.text ?? ''));
  return { speaker, text };
}

/** Insert newline before host:/cohost: when not at document start or line start. */
function insertNewlinesBeforeSpeakerLabels(content: string, hostName: string, cohostName: string): string {
  const unique = [hostName, cohostName].filter((n, i, a) => a.indexOf(n) === i);
  const sorted = [...unique].sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${sorted.map(escapeRegex).join('|')}):`, 'g');
  return content.replace(re, (match, _g, offset, str) => {
    if (offset === 0) return match;
    if (str[offset - 1] === '\n') return match;
    return `\n${match}`;
  });
}

function parseScript(content: string, hostName: string, cohostName: string): any[] {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.map(toScriptLine);
    }
    return [];
  } catch (e) {
    const normalized = normalizeForTerminal(content).replace(/\\n/g, '\n');
    const withSpeakerBreaks = insertNewlinesBeforeSpeakerLabels(normalized, hostName, cohostName);
    return (
      withSpeakerBreaks
      .split('\n')
      .filter(l => l.trim())
      .map(line => {
        // Handle both "Speaker: Text" and "Speaker：Text"
        const match = line.match(/^([^:：]+)[:：]\s*(.*)$/);
        if (match) {
          return toScriptLine({ speaker: match[1], text: match[2].trim() });
        }
        return toScriptLine({ speaker: '?', text: line });
      }));
  }
}
