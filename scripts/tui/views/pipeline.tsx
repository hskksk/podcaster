import React from 'react';
import { Box, Text } from 'ink';
import { Episode } from '../data/types.js';

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Episode } from '../data/types.js';

interface Props {
  data: {
    episodes: Episode[];
  };
  focus: string;
  onSelectEpisode: (episodeId: string) => void;
}

const STAGES = [
  { key: 'script_pending', label: 'INGESTED' },
  { key: 'script_ready',   label: 'SCRIPT READY' },
  { key: 'audio_ready',    label: 'AUDIO READY' },
  { key: 'published',      label: 'PUBLISHED' },
];

export const PipelineView: React.FC<Props> = ({ data, focus, onSelectEpisode }) => {
  const { episodes } = data;
  const [offsets, setOffsets] = useState<number[]>([0, 0, 0, 0]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([-1, -1, -1, -1]);
  const limit = 10; // Adjust based on height if needed, but 10 is a safe start

  const getEpisodesByStatus = (status: string) => {
    return episodes.filter(e => e.status === status);
  };

  useInput((input, key) => {
    if (!focus.startsWith('pipeline_')) return;
    const laneIndex = parseInt(focus.split('_')[1]);
    const laneEpisodes = getEpisodesByStatus(STAGES[laneIndex].key);

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

    if (key.return) { // Enter key
      const selectedEpisode = laneEpisodes[selectedIndices[laneIndex]];
      if (selectedEpisode) {
        onSelectEpisode(selectedEpisode.id);
      }
    }
  });

  return (
    <Box flexDirection="row" height="100%" width="100%" flexGrow={1} minWidth={0}>
      {STAGES.map((stage, index) => {
        const stageEpisodes = getEpisodesByStatus(stage.key);
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
            borderColor={isFocused ? "cyan" : "gray"}
          >
            <Box borderStyle="single" justifyContent="center" flexShrink={0} borderColor={isFocused ? "cyan" : "gray"}>
              <Text bold color={isFocused ? "cyan" : "white"}>
                {stage.label} {isFocused ? "●" : ""}
              </Text>
            </Box>
            <Box flexDirection="column" marginTop={1} flexGrow={1} overflowY="hidden">
              {visibleEpisodes.map((e, itemIndex) => {
                const isSelected = isFocused && (itemIndex + offset) === selectedIndex;
                return (
                  <Box key={e.id} marginBottom={1} borderStyle="single" borderColor={isSelected ? "yellow" : (isFocused ? "gray" : "transparent")} flexShrink={0} paddingX={1}>
                    <Text wrap="truncate-end" color={isSelected ? "yellow" : "white"}>{isSelected ? "▸ " : "  "}{e.title}</Text>
                  </Box>
                );
              })}
              {stageEpisodes.length === 0 && (
                <Box justifyContent="center" marginTop={2}>
                  <Text color="gray" italic>Empty</Text>
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
  );
};
