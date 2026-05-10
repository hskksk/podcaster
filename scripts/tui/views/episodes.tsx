import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { Article, AudioFile, Episode, Script, PodcastConfig } from '../data/types.js';
import { DataClient } from '../data/client.js';
import { matchesTextFilter } from '../utils/text-filter.js';
import type { OpenConfirmPayload } from '../confirm-types.js';
import type { ToastTone } from '../components/toast.js';

interface Props {
  episodes: Episode[];
  articles: Article[];
  audioFiles: AudioFile[];
  config: PodcastConfig[];
  focus: 'sidebar' | 'list' | 'detail';
  client: DataClient;
  rows: number;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  keyboardEnabled: boolean;
  filterQuery: string;
  openConfirm: (p: OpenConfirmPayload) => void;
  showToast: (message: string, tone: ToastTone) => void;
  onRefresh: () => void | Promise<void>;
}

export const EpisodesView: React.FC<Props> = ({
  episodes,
  articles,
  audioFiles,
  config,
  focus,
  client,
  rows,
  selectedId,
  onSelectId,
  keyboardEnabled,
  filterQuery,
  openConfirm,
  showToast,
  onRefresh
}) => {
  const [script, setScript] = useState<Script | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [audioDurationSec, setAudioDurationSec] = useState<number | null>(null);
  const [audioDurationLoading, setAudioDurationLoading] = useState(false);

  const hostName = config.find(c => c.key === 'tts.host.name')?.value || 'Host';
  const cohostName = config.find(c => c.key === 'tts.cohost.name')?.value || 'CoHost';

  const limit = Math.max(4, rows - 27);

  const filteredEpisodes = useMemo(
    () =>
      episodes.filter(e =>
        matchesTextFilter(filterQuery, [e.id, e.title, e.status, e.created_at, e.article_id, e.mem_note_id])
      ),
    [episodes, filterQuery]
  );

  useEffect(() => {
    if (filteredEpisodes.length === 0) {
      onSelectId(null);
      return;
    }
    if (selectedId && filteredEpisodes.some(e => e.id === selectedId)) return;
    onSelectId(filteredEpisodes[0].id);
  }, [filteredEpisodes, selectedId, onSelectId]);

  useEffect(() => {
    if (selectedId) {
      setScript(null);
      setScriptLoading(true);
      setScrollOffset(0);
      client.fetchScript(selectedId).then(result => {
        setScript(result);
        setScriptLoading(false);
      });
    }
  }, [selectedId, client]);

  useInput((input, key) => {
    if (!keyboardEnabled || focus !== 'detail') return;

    const ep = filteredEpisodes.find(e => e.id === selectedId);
    if (ep && key.ctrl) {
      if (input === 's') {
        openConfirm({
          title: 'Requeue script',
          message: `Start script flow?\n${ep.title}\nepisode_id: ${ep.id}`,
          onConfirm: async () => {
            const r = await client.requeue('script', ep.id);
            if (!r.success) {
              showToast(r.error ?? 'Requeue failed', 'error');
              return;
            }
            showToast('Script job queued', 'success');
            await onRefresh();
          }
        });
        return;
      }
      if (input === 'a') {
        openConfirm({
          title: 'Requeue audio',
          message: `Start audio flow?\n${ep.title}`,
          onConfirm: async () => {
            const r = await client.requeue('audio', ep.id);
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
      if (input === 'y') {
        openConfirm({
          title: 'Requeue RSS',
          message: `Start rss flow?\n${ep.title}`,
          onConfirm: async () => {
            const r = await client.requeue('rss', ep.id);
            if (!r.success) {
              showToast(r.error ?? 'Requeue failed', 'error');
              return;
            }
            showToast('RSS job queued', 'success');
            await onRefresh();
          }
        });
        return;
      }
      if (input === 'g') {
        openConfirm({
          title: 'Regenerate script (same episode)',
          message: `Regenerate script and continue to audio/rss?\n${ep.title}\nepisode_id: ${ep.id}`,
          onConfirm: async () => {
            const r = await client.requeue('script', ep.id, { regenerate: true });
            if (!r.success) {
              showToast(r.error ?? 'Regenerate script failed', 'error');
              return;
            }
            showToast('Script regeneration queued', 'success');
            await onRefresh();
          }
        });
        return;
      }
      if (input === 'r') {
        openConfirm({
          title: 'Regenerate audio (same episode)',
          message: `Regenerate audio and update rss?\n${ep.title}\nepisode_id: ${ep.id}`,
          onConfirm: async () => {
            const r = await client.requeue('audio', ep.id, { regenerate: true });
            if (!r.success) {
              showToast(r.error ?? 'Regenerate audio failed', 'error');
              return;
            }
            showToast('Audio regeneration queued', 'success');
            await onRefresh();
          }
        });
        return;
      }
      if (input === 'd') {
        openConfirm({
          title: 'Download audio',
          message: `Download latest audio for episode to ./downloads\n${ep.title}`,
          onConfirm: async () => {
            const r = await client.downloadAudio(ep.id);
            if (!r.success) {
              showToast(r.error ?? 'Download failed', 'error');
              return;
            }
            showToast(r.path ? `Saved: ${r.path}` : 'Downloaded', 'success');
          }
        });
        return;
      }
    }

    if (ep && input === 'p' && !key.ctrl && !key.meta) {
      void client.playAudio(ep.id).then(r => {
        if (!r.success) {
          showToast(r.error ?? 'Play failed', 'error');
          return;
        }
        showToast('Playback started (afplay)', 'success');
      });
      return;
    }

    if (input === 's' && !key.ctrl && !key.meta) {
      client.stopPlayback();
      showToast('Stopped playback', 'info');
      return;
    }

    if (key.downArrow || input === 'j') {
      setScrollOffset(prev => prev + 1);
    }
    if (key.upArrow || input === 'k') {
      setScrollOffset(prev => Math.max(0, prev - 1));
    }
  });

  const items = filteredEpisodes.map(e => ({
    label: `${e.status.padEnd(14)} │ ${e.title}`,
    value: e.id
  }));

  const selectedEpisode = filteredEpisodes.find(e => e.id === selectedId);
  const selectedAudio = selectedEpisode
    ? audioFiles.find(af => af.episode_id === selectedEpisode.id)
    : undefined;
  const selectedArticle = selectedEpisode?.article_id
    ? articles.find(article => article.id === selectedEpisode.article_id)
    : undefined;
  const scriptLines = script ? parseScript(script.content, hostName, cohostName) : [];
  const scriptSummary = scriptLoading ? 'Loading script...' : summarizeScript(scriptLines);
  const scriptTotalTokens = extractTotalTokens(script?.llm_usage);
  const articleSummary = summarizeArticle(selectedEpisode, selectedArticle);
  const audioTotalTokens = extractTotalTokens(selectedAudio?.llm_usage);
  const pipelineNodes = selectedEpisode ? buildPipelineNodes(selectedEpisode.status) : [];
  const visibleScript = scriptLines.slice(scrollOffset, scrollOffset + limit);

  useEffect(() => {
    let cancelled = false;

    if (!selectedAudio) {
      setAudioDurationSec(null);
      setAudioDurationLoading(false);
      return;
    }

    setAudioDurationLoading(true);
    void client.fetchAudioDurationSeconds(selectedAudio.id).then(durationSec => {
      if (cancelled) return;
      setAudioDurationSec(durationSec);
      setAudioDurationLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [client, selectedAudio?.id]);

  const renderItem = (item: any, isSelected: boolean) => (
    <Text color={isSelected ? "yellow" : "white"} wrap="truncate-end">
      {isSelected ? "▸ " : "  "}{item.label}
    </Text>
  );

  return (
    <Box flexDirection="row" height="100%" width="100%" flexGrow={1} minWidth={0}>
      <Box width="35%" borderStyle="single" flexDirection="column" borderColor={focus === 'list' ? "cyan" : "gray"} flexShrink={0}>
        <Box borderStyle="single" justifyContent="center" flexShrink={0} borderColor={focus === 'list' ? "cyan" : "gray"}>
          <Text bold color={focus === 'list' ? "cyan" : "white"}>
            EPISODES
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
                key={filterQuery}
                items={items}
                limit={Math.max(5, rows - 10)}
                onHighlight={(item) => onSelectId(item.value)}
                onSelect={(item) => onSelectId(item.value)}
                initialIndex={Math.max(0, filteredEpisodes.findIndex(e => e.id === selectedId))}
                indicatorComponent={() => null} // Hide default indicator
                itemComponent={({ label, isSelected }) => renderItem({ label }, isSelected)}
              />
            ) : (
              <Text color="gray">No episodes match filter</Text>
            )
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
          <Text bold color={focus === 'detail' ? "cyan" : "white"}>
            DETAIL {focus === 'detail' ? '● j/k │ p play / s stop │ Ctrl+S script / A audio / Y rss / G regen-script / R regen-audio / D download' : ''}
          </Text>
        </Box>
        {selectedEpisode ? (
          <Box flexDirection="column" marginTop={1} flexGrow={1} overflowY="hidden">
            <Box flexShrink={0}>
              <Text bold color="yellow" wrap="truncate-end">{selectedEpisode.title}</Text>
            </Box>
            <Box flexShrink={0}>
              <Text color="gray">Status: {selectedEpisode.status} │ Created: {new Date(selectedEpisode.created_at).toLocaleDateString()}</Text>
            </Box>
            <Box marginTop={1} flexShrink={0} flexDirection="column">
              <Text bold color="cyan">SCRIPT SUMMARY</Text>
              <Text color="gray" wrap="truncate-end">{scriptSummary}</Text>
              <Text color="gray" wrap="truncate-end">Tokens: {formatTokenCount(scriptTotalTokens, scriptLoading)}</Text>
            </Box>
            <Box marginTop={1} flexShrink={0} flexDirection="column">
              <Text bold color="cyan">ARTICLE SUMMARY</Text>
              <Text color="gray" wrap="truncate-end">{articleSummary}</Text>
            </Box>
            <Box marginTop={1} flexShrink={0} flexDirection="column">
              <Text bold color="cyan">AUDIO</Text>
              {selectedAudio ? (
                <Box flexDirection="column">
                  <Text color="gray" wrap="truncate-end">Path: {selectedAudio.storage_path}</Text>
                  <Text color="gray" wrap="truncate-end">ID: {selectedAudio.id}</Text>
                  <Text color="gray" wrap="truncate-end">Type: {selectedAudio.mime_type} │ Status: {selectedAudio.status}</Text>
                  <Text color="gray" wrap="truncate-end">Tokens: {formatTokenCount(audioTotalTokens, false)}</Text>
                  <Text color="gray" wrap="truncate-end">Length: {formatAudioDuration(audioDurationSec, audioDurationLoading)}</Text>
                  <Text color="gray" wrap="truncate-end">Created: {new Date(selectedAudio.created_at).toLocaleString()}</Text>
                </Box>
              ) : (
                <Text color="gray">No audio file for this episode</Text>
              )}
            </Box>
            <Box marginTop={1} flexShrink={0} flexDirection="column">
              <Text bold color="cyan">PIPELINE</Text>
              <Box flexDirection="row" flexWrap="wrap">
                {pipelineNodes.map((node, idx) => (
                  <Text
                    key={node.key}
                    color={node.state === 'failed' ? 'red' : node.state === 'running' ? 'yellow' : node.state === 'done' ? 'green' : 'gray'}
                  >
                    {node.state === 'failed' ? '✕' : node.state === 'running' ? '◐' : node.state === 'done' ? '●' : '○'} {node.label}
                    {idx < pipelineNodes.length - 1 ? <Text color="gray">  →  </Text> : ''}
                  </Text>
                ))}
              </Box>
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
                  <Text color="gray italic">{scriptLoading ? 'Loading script...' : 'No script yet'}</Text>
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

function summarizeScript(lines: Array<{ speaker: string; text: string }>): string {
  if (lines.length === 0) return 'No script generated yet.';
  const speakers = Array.from(new Set(lines.map(line => line.speaker).filter(Boolean)));
  const charCount = lines.reduce((sum, line) => sum + line.text.length, 0);
  return `${lines.length} lines · ${charCount} chars · ${speakers.length} speakers (${speakers.join(', ')})`;
}

function summarizeArticle(selectedEpisode?: Episode, selectedArticle?: Article): string {
  if (!selectedEpisode?.article_id) return 'No linked article';
  if (!selectedArticle) return `Linked article not found (${selectedEpisode.article_id})`;

  const normalized = normalizeForTerminal(String(selectedArticle.content ?? ''));
  const lineCount = normalized.length === 0 ? 0 : normalized.split('\n').length;
  const charCount = normalized.length;

  return `${lineCount} lines · ${charCount} chars`;
}

function formatAudioDuration(seconds: number | null, loading: boolean): string {
  if (loading) return 'Loading...';
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '-';

  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remaining = totalSeconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')} (${seconds.toFixed(1)}s)`;
}

function extractTotalTokens(usage: unknown): number | null {
  if (!usage || typeof usage !== 'object') return null;
  const usageRecord = usage as Record<string, unknown>;

  const candidates = [
    usageRecord.total_tokens,
    usageRecord.totalTokenCount,
    usageRecord.total_token_count
  ];

  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function formatTokenCount(totalTokens: number | null, loading: boolean): string {
  if (loading) return 'Loading...';
  if (totalTokens == null) return '-';
  return `${totalTokens.toLocaleString()} total`;
}

function buildPipelineNodes(
  status: string
): Array<{ key: string; label: string; state: 'done' | 'pending' | 'running' | 'failed' }> {
  const scriptDone = ['script_ready', 'audio_running', 'audio_generated', 'audio_downloading', 'audio_ready', 'audio_failed', 'published', 'rss_failed'].includes(status);
  const audioDone = ['audio_generated', 'audio_downloading', 'audio_ready', 'published', 'rss_failed'].includes(status);
  const rssDone = status === 'published';
  const scriptRunning = status === 'script_running';
  const audioRunning = ['audio_running', 'audio_generated', 'audio_downloading'].includes(status);
  const scriptFailed = status === 'script_failed' || status === 'failed';
  const audioFailed = status === 'audio_failed' || (status === 'failed' && scriptDone && !audioDone);
  const rssFailed = status === 'rss_failed';
  return [
    { key: 'ingest', label: 'ingest', state: 'done' },
    { key: 'script', label: 'generate-script', state: scriptFailed ? 'failed' : scriptRunning ? 'running' : scriptDone ? 'done' : 'pending' },
    { key: 'audio', label: 'generate-audio', state: audioFailed ? 'failed' : audioRunning ? 'running' : audioDone ? 'done' : 'pending' },
    { key: 'rss', label: 'update-rss', state: rssFailed ? 'failed' : rssDone ? 'done' : 'pending' }
  ];
}

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
