import React, { useState, useMemo, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
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
  /** Ctrl+I/i on a focused lane: regenerate episode artwork (confirm in App). */
  onRegenerateImageRequest: (episodeId: string) => void;
}

export const PIPELINE_STAGES = [
  /** Backward-compatible: old rows used script_pending. */
  { key: 'ingested', label: 'INGESTED', statuses: ['ingested', 'script_pending'] },
  { key: 'script_running', label: 'SCRIPT RUN', statuses: ['script_running'] },
  { key: 'script_ready', label: 'SCRIPT OK', statuses: ['script_ready'] },
  { key: 'audio_running', label: 'AUDIO RUN', statuses: ['audio_running', 'audio_generated', 'audio_downloading'] },
  { key: 'audio_ready', label: 'AUDIO OK', statuses: ['audio_ready'] },
  { key: 'failed', label: 'FAILED', statuses: ['script_failed', 'audio_failed', 'rss_failed', 'failed'] },
  { key: 'published', label: 'PUBLISHED', statuses: ['published'] }
];

/** Number of lanes in the pipeline board; App uses it for h/l lane movement. */
export const PIPELINE_LANE_COUNT = PIPELINE_STAGES.length;

/**
 * Move a lane cursor by `delta` and keep the visible window in range.
 * Clamping the offset here is what prevents a stray negative offset (which
 * made `slice` show the tail of the lane) when pressing up at the top.
 */
export const moveLaneCursor = (
  selected: number,
  offset: number,
  laneLength: number,
  limit: number,
  delta: number
): { selected: number; offset: number } => {
  if (laneLength === 0) return { selected: -1, offset: 0 };
  if (selected < 0) return { selected: 0, offset: 0 };
  const nextSelected = Math.max(0, Math.min(selected + delta, laneLength - 1));
  let nextOffset = Math.max(0, Math.min(offset, Math.max(0, laneLength - limit)));
  if (nextSelected < nextOffset) nextOffset = nextSelected;
  if (nextSelected >= nextOffset + limit) nextOffset = nextSelected - limit + 1;
  return {
    selected: nextSelected,
    offset: Math.max(0, Math.min(nextOffset, Math.max(0, laneLength - limit)))
  };
};

export const PipelineView: React.FC<Props> = ({
  data,
  focus,
  onSelectEpisode,
  keyboardEnabled,
  filterQuery,
  onRequeueAudioRequest,
  onRegenerateImageRequest
}) => {
  const { episodes } = data;
  const { stdout } = useStdout();
  const [offsets, setOffsets] = useState<number[]>(() => PIPELINE_STAGES.map(() => 0));
  const [selectedIndices, setSelectedIndices] = useState<number[]>(() => PIPELINE_STAGES.map(() => -1));
  /** One line per episode, so the lane can show every row the terminal height allows. */
  const limit = Math.max(5, (stdout?.rows ?? 24) - 8);

  const filteredEpisodes = useMemo(() => {
    return episodes.filter(e =>
      matchesTextFilter(filterQuery, [e.id, e.title, e.status, e.created_at, e.article_id, e.mem_note_id])
    );
  }, [episodes, filterQuery]);

  const getEpisodesByStage = (stage: (typeof PIPELINE_STAGES)[number]) =>
    filteredEpisodes.filter(e => stage.statuses.includes(e.status));

  useEffect(() => {
    setSelectedIndices(prev =>
      PIPELINE_STAGES.map((stage, laneIndex) => {
        const lane = getEpisodesByStage(stage);
        if (lane.length === 0) return -1;
        const cur = prev[laneIndex];
        const next = cur < 0 ? 0 : Math.min(cur, lane.length - 1);
        return next;
      })
    );
    setOffsets(prev =>
      prev.map((off, laneIndex) => {
        const laneLen = getEpisodesByStage(PIPELINE_STAGES[laneIndex]).length;
        return Math.min(off, Math.max(0, laneLen - limit));
      })
    );
  }, [filteredEpisodes, limit]);

  useInput((input, key) => {
    if (!keyboardEnabled || !focus.startsWith('pipeline_')) return;
    const laneIndex = parseInt(focus.split('_')[1]);
    const laneEpisodes = getEpisodesByStage(PIPELINE_STAGES[laneIndex]);

    /**
     * Move the lane cursor and keep it inside the visible window. Both the
     * selection and the scroll offset are clamped so repeated up/down at
     * either end cannot push the offset out of range.
     */
    const moveSelection = (delta: number) => {
      const next = moveLaneCursor(
        selectedIndices[laneIndex],
        offsets[laneIndex],
        laneEpisodes.length,
        limit,
        delta
      );
      setSelectedIndices(prev => {
        const copy = [...prev];
        copy[laneIndex] = next.selected;
        return copy;
      });
      setOffsets(prev => {
        const copy = [...prev];
        copy[laneIndex] = next.offset;
        return copy;
      });
    };

    if (key.downArrow || input === 'j') {
      moveSelection(1);
    }

    if (key.upArrow || input === 'k') {
      moveSelection(-1);
    }

    if (key.return) {
      const selectedEpisode = laneEpisodes[selectedIndices[laneIndex]];
      if (selectedEpisode) {
        onSelectEpisode(selectedEpisode.id);
      }
    }

    if (key.ctrl && (input === 'a' || input === 'A')) {
      const selectedEpisode = laneEpisodes[selectedIndices[laneIndex]];
      if (selectedEpisode) {
        onRequeueAudioRequest(selectedEpisode.id);
      }
    }

    if (key.ctrl && (input === 'i' || input === 'I')) {
      const selectedEpisode = laneEpisodes[selectedIndices[laneIndex]];
      if (selectedEpisode) {
        onRegenerateImageRequest(selectedEpisode.id);
      }
    }
  });

  const fq = filterQuery.trim();

  return (
    <Box flexDirection="column" height="100%" width="100%" flexGrow={1} minWidth={0}>
      {(fq || keyboardEnabled) && (
        <Box paddingX={1} flexShrink={0}>
          {fq ? (
            <>
              <Text dimColor>match: </Text>
              <Text color="magenta">{fq}</Text>
              <Text dimColor> │ </Text>
            </>
          ) : null}
          {keyboardEnabled ? (
            <Text dimColor>Ctrl+A requeue │ Ctrl+I regen art</Text>
          ) : null}
        </Box>
      )}
      <Box flexDirection="row" flexGrow={1} minHeight={0}>
        {PIPELINE_STAGES.map((stage, index) => {
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
              borderStyle="single"
              marginX={0}
              height="100%"
              borderColor={isFocused ? 'cyan' : 'gray'}
            >
              <Box justifyContent="center" flexShrink={0}>
                <Text bold color={isFocused ? 'cyan' : 'white'} wrap="truncate-end">
                  {stage.label} {stageEpisodes.length}
                </Text>
              </Box>
              <Box flexDirection="column" flexGrow={1} overflowY="hidden">
                {visibleEpisodes.map((e, itemIndex) => {
                  const isSelected = isFocused && itemIndex + offset === selectedIndex;
                  return (
                    <Box key={e.id} flexShrink={0}>
                      <Text wrap="truncate-end" color={isSelected ? 'yellow' : 'white'} bold={isSelected}>
                        {e.title}
                      </Text>
                    </Box>
                  );
                })}
                {stageEpisodes.length === 0 && (
                  <Box justifyContent="center" marginTop={1}>
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
