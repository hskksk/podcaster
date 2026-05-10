import React, { useState, useMemo, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Episode } from '../data/types.js';
import { matchesTextFilter } from '../utils/text-filter.js';

interface Props {
  data: {
    episodes: Episode[];
  };
  focus: string;
  onSelectEpisode: (episodeId: string) => void;
  keyboardEnabled: boolean;
  filterQuery: string;
  /** Ctrl+A on a focused lane: requeue audio for the highlighted episode (confirm in App). */
  onRequeueAudioRequest: (episodeId: string) => void;
}

const STAGES = [
  /** Backward-compatible: old rows used script_pending. */
  { key: 'ingested', label: 'INGESTED', statuses: ['ingested', 'script_pending'] },
  { key: 'script_running', label: 'SCRIPT RUNNING', statuses: ['script_running'] },
  { key: 'script_ready', label: 'SCRIPT READY', statuses: ['script_ready'] },
  { key: 'audio_running', label: 'AUDIO PIPELINE', statuses: ['audio_running', 'audio_generated', 'audio_downloading'] },
  { key: 'audio_ready', label: 'AUDIO READY', statuses: ['audio_ready'] },
  { key: 'failed', label: 'FAILED', statuses: ['script_failed', 'audio_failed', 'rss_failed', 'failed'] },
  { key: 'published', label: 'PUBLISHED', statuses: ['published'] }
];

export const PipelineView: React.FC<Props> = ({
  data,
  focus,
  onSelectEpisode,
  keyboardEnabled,
  filterQuery,
  onRequeueAudioRequest
}) => {
  const { episodes } = data;
  const [offsets, setOffsets] = useState<number[]>(() => STAGES.map(() => 0));
  const [selectedIndices, setSelectedIndices] = useState<number[]>(() => STAGES.map(() => -1));
  const limit = 10;

  const filteredEpisodes = useMemo(() => {
    return episodes.filter(e =>
      matchesTextFilter(filterQuery, [e.id, e.title, e.status, e.created_at, e.article_id, e.mem_note_id])
    );
  }, [episodes, filterQuery]);

  const getEpisodesByStage = (stage: (typeof STAGES)[number]) =>
    filteredEpisodes.filter(e => stage.statuses.includes(e.status));

  useEffect(() => {
    setSelectedIndices(prev =>
      STAGES.map((stage, laneIndex) => {
        const lane = getEpisodesByStage(stage);
        if (lane.length === 0) return -1;
        const cur = prev[laneIndex];
        const next = cur < 0 ? 0 : Math.min(cur, lane.length - 1);
        return next;
      })
    );
    setOffsets(prev =>
      prev.map((off, laneIndex) => {
        const laneLen = getEpisodesByStage(STAGES[laneIndex]).length;
        return Math.min(off, Math.max(0, laneLen - limit));
      })
    );
  }, [filteredEpisodes, limit]);

  useInput((input, key) => {
    if (!keyboardEnabled || !focus.startsWith('pipeline_')) return;
    const laneIndex = parseInt(focus.split('_')[1]);
    const laneEpisodes = getEpisodesByStage(STAGES[laneIndex]);

    if (key.downArrow || input === 'j') {
      setSelectedIndices(prev => {
        const next = [...prev];
        next[laneIndex] = Math.min(prev[laneIndex] + 1, laneEpisodes.length - 1);
        return next;
      });
      setOffsets(prev => {
        const next = [...prev];
        if (selectedIndices[laneIndex] + 1 >= prev[laneIndex] + limit) {
          next[laneIndex] = prev[laneIndex] + 1;
        }
        return next;
      });
    }

    if (key.upArrow || input === 'k') {
      setSelectedIndices(prev => {
        const next = [...prev];
        next[laneIndex] = Math.max(prev[laneIndex] - 1, 0);
        return next;
      });
      setOffsets(prev => {
        const next = [...prev];
        if (selectedIndices[laneIndex] - 1 < prev[laneIndex]) {
          next[laneIndex] = prev[laneIndex] - 1;
        }
        return next;
      });
    }

    if (key.return) {
      const selectedEpisode = laneEpisodes[selectedIndices[laneIndex]];
      if (selectedEpisode) {
        onSelectEpisode(selectedEpisode.id);
      }
    }

    if (key.ctrl && input === 'a') {
      const selectedEpisode = laneEpisodes[selectedIndices[laneIndex]];
      if (selectedEpisode) {
        onRequeueAudioRequest(selectedEpisode.id);
      }
    }
  });

  const fq = filterQuery.trim();

  return (
    <Box flexDirection="column" height="100%" width="100%" flexGrow={1} minWidth={0}>
      {fq ? (
        <Box paddingX={1} flexShrink={0}>
          <Text dimColor>match: </Text>
          <Text color="magenta">{fq}</Text>
        </Box>
      ) : null}
      {keyboardEnabled && (
        <Box paddingX={1} flexShrink={0}>
          <Text dimColor>Ctrl+A: requeue audio (selected card)</Text>
        </Box>
      )}
      <Box flexDirection="row" flexGrow={1} minHeight={0}>
        {STAGES.map((stage, index) => {
          const stageEpisodes = getEpisodesByStage(stage);
          const isFocused = focus === `pipeline_${index}`;
          const offset = offsets[index];
          const selectedIndex = selectedIndices[index];
          const visibleEpisodes = stageEpisodes.slice(offset, offset + limit);

          return (
            <Box
              key={stage.key}
              flexDirection="column"
              flexBasis={0}
              flexGrow={1}
              minWidth={0}
              borderStyle="round"
              marginX={0}
              paddingX={1}
              height="100%"
              borderColor={isFocused ? 'cyan' : 'gray'}
            >
              <Box borderStyle="single" justifyContent="center" flexShrink={0} borderColor={isFocused ? 'cyan' : 'gray'}>
                <Text bold color={isFocused ? 'cyan' : 'white'}>
                  {stage.label} {isFocused ? '●' : ''}
                </Text>
              </Box>
              <Box flexDirection="column" marginTop={1} flexGrow={1} overflowY="hidden">
                {visibleEpisodes.map((e, itemIndex) => {
                  const isSelected = isFocused && itemIndex + offset === selectedIndex;
                  return (
                    <Box
                      key={e.id}
                      marginBottom={1}
                      borderStyle="single"
                      borderColor={isSelected ? 'yellow' : isFocused ? 'gray' : 'transparent'}
                      flexShrink={0}
                      paddingX={1}
                    >
                      <Text wrap="truncate-end" color={isSelected ? 'yellow' : 'white'}>
                        {isSelected ? '▸ ' : '  '}
                        {e.title}
                      </Text>
                    </Box>
                  );
                })}
                {stageEpisodes.length === 0 && (
                  <Box justifyContent="center" marginTop={2}>
                    <Text color="gray" italic>
                      Empty
                    </Text>
                  </Box>
                )}
                {stageEpisodes.length > limit && (
                  <Box justifyContent="center" marginTop="auto" flexShrink={0}>
                    <Text color="gray" dimColor size="tiny">
                      --- {offset + 1}-{offset + visibleEpisodes.length} / {stageEpisodes.length} ---
                    </Text>
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
