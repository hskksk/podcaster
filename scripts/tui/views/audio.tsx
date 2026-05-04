import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { AudioFile, Episode } from '../data/types.js';
import { matchesTextFilter } from '../utils/text-filter.js';
import { DataClient } from '../data/client.js';
import type { OpenConfirmPayload } from '../confirm-types.js';
import type { ToastTone } from '../components/toast.js';

interface Props {
  audioFiles: AudioFile[];
  episodes: Episode[];
  isFocused: boolean;
  columns: number;
  keyboardEnabled: boolean;
  filterQuery: string;
  client: DataClient;
  openConfirm: (p: OpenConfirmPayload) => void;
  showToast: (message: string, tone: ToastTone) => void;
  onRefresh: () => void | Promise<void>;
}

function buildAudioDetailMessage(ep: Episode | undefined, af: AudioFile): string {
  const title = ep?.title ?? '(episode not loaded)';
  const lines = [
    `Episode title\n${title}`,
    `Episode ID\n${af.episode_id}`,
    `Audio file ID\n${af.id}`,
    `Storage path\n${af.storage_path}`,
    `MIME type\n${af.mime_type}`,
    `Status\n${af.status}`,
    `Created\n${af.created_at}`
  ];
  if (af.error) lines.push(`Error\n${af.error}`);
  return lines.join('\n\n');
}

export const AudioView: React.FC<Props> = ({
  audioFiles,
  episodes,
  isFocused,
  columns,
  keyboardEnabled,
  filterQuery,
  client,
  openConfirm,
  showToast,
  onRefresh
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const episodeById = useMemo(() => {
    const m = new Map<string, Episode>();
    for (const e of episodes) m.set(e.id, e);
    return m;
  }, [episodes]);

  const filteredFiles = useMemo(
    () =>
      audioFiles.filter(af => {
        const ep = episodeById.get(af.episode_id);
        return matchesTextFilter(filterQuery, [
          af.id,
          af.episode_id,
          af.storage_path,
          af.mime_type,
          af.status,
          af.error,
          af.created_at,
          ep?.title ?? ''
        ]);
      }),
    [audioFiles, filterQuery, episodeById]
  );

  const cardsPerRow = useMemo(() => {
    const sidebarWidth = 22;
    const mainWidth = Math.max(20, columns - sidebarWidth);
    const cardOuterWidth = 42;
    return Math.max(1, Math.floor(mainWidth / cardOuterWidth));
  }, [columns]);

  useEffect(() => {
    if (filteredFiles.length === 0) {
      setSelectedIndex(null);
      return;
    }
    if (!isFocused) return;
    setSelectedIndex(prev => {
      if (prev == null) return 0;
      return Math.min(prev, filteredFiles.length - 1);
    });
  }, [filteredFiles.length, isFocused]);

  useInput((input, key) => {
    if (!keyboardEnabled || !isFocused || filteredFiles.length === 0) return;
    if (selectedIndex == null) return;

    const af = filteredFiles[selectedIndex];
    const ep = episodeById.get(af.episode_id);

    if (input === 'i' && !key.ctrl && !key.meta) {
      openConfirm({
        title: 'Audio detail',
        message: buildAudioDetailMessage(ep, af),
        readOnly: true,
        onConfirm: async () => {}
      });
      return;
    }

    if (key.ctrl && input === 'd') {
      openConfirm({
        title: 'Download audio file',
        message: af.storage_path,
        onConfirm: async () => {
          const r = await client.downloadAudio(af.id);
          if (!r.success) {
            showToast(r.error ?? 'Download failed', 'error');
            return;
          }
          showToast(r.path ? `Saved: ${r.path}` : 'Downloaded', 'success');
        }
      });
      return;
    }

    if (key.ctrl && input === 'a') {
      openConfirm({
        title: 'Requeue audio',
        message: `episode_id: ${af.episode_id}`,
        onConfirm: async () => {
          const r = await client.requeue('audio', af.episode_id);
          if (!r.success) {
            showToast(r.error ?? 'Requeue failed', 'error');
            return;
          }
          showToast('Audio job queued', 'success');
          await onRefresh();
        }
      });
      return;
    }

    if (input === 'p' && !key.ctrl && !key.meta) {
      openConfirm({
        title: 'Play audio',
        message: process.platform === 'darwin' ? af.storage_path : 'Play uses afplay (macOS only)',
        onConfirm: async () => {
          const r = await client.playAudio(af.id);
          if (!r.success) {
            showToast(r.error ?? 'Play failed', 'error');
            return;
          }
          showToast('Playback started (afplay)', 'success');
        }
      });
      return;
    }

    if (input === 's' && !key.ctrl && !key.meta) {
      client.stopPlayback();
      showToast('Stopped playback', 'info');
      return;
    }

    const maxIndex = filteredFiles.length - 1;
    let next = selectedIndex;

    if (key.leftArrow || input === 'h') next = selectedIndex - 1;
    if (key.rightArrow || input === 'l') next = selectedIndex + 1;
    if (key.downArrow || input === 'j') next = selectedIndex + cardsPerRow;
    if (key.upArrow || input === 'k') next = selectedIndex - cardsPerRow;

    if (next !== selectedIndex) {
      setSelectedIndex(Math.max(0, Math.min(maxIndex, next)));
    }
  });

  const fq = filterQuery.trim();

  return (
    <Box flexDirection="column" height="100%" width="100%" flexGrow={1} minWidth={0}>
      <Box borderStyle="single" justifyContent="center" borderColor={isFocused ? 'cyan' : 'gray'}>
        <Text bold>
          AUDIO FILES
          {fq ? (
            <>
              <Text color="gray"> │ </Text>
              <Text dimColor>match: </Text>
              <Text color="magenta">{fq}</Text>
            </>
          ) : null}
        </Text>
      </Box>
      <Box flexDirection="row" flexWrap="wrap" paddingX={1} marginTop={1} flexGrow={1}>
        {filteredFiles.map((af, i) => {
          const ep = episodeById.get(af.episode_id);
          const listTitle = ep?.title?.trim() || '(no episode title)';
          return (
            <Box
              key={af.id}
              borderStyle="single"
              borderColor={isFocused && selectedIndex === i ? 'yellow' : 'gray'}
              margin={1}
              paddingX={1}
              width={40}
            >
              <Box flexDirection="column">
                <Text bold color="yellow">{listTitle}</Text>
                <Text color="gray">
                  {af.status}
                  {' · '}
                  {af.mime_type}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>
      {keyboardEnabled && isFocused && (
        <Box paddingX={1} flexShrink={0}>
          <Text dimColor>i detail │ p play │ s stop │ Ctrl+D download │ Ctrl+A requeue</Text>
        </Box>
      )}
    </Box>
  );
};
