import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { InboxFile } from '../data/types.js';
import { matchesTextFilter } from '../utils/text-filter.js';
import { DataClient } from '../data/client.js';
import type { ToastTone } from '../components/toast.js';
import type { OpenConfirmPayload } from '../confirm-types.js';

export type InboxPane = 'inbox' | 'draft';

interface Props {
  inbox: InboxFile[];
  draft: InboxFile[];
  filterQuery: string;
  keyboardEnabled: boolean;
  /** Active column; h/l / arrows are handled in App when focus is list. */
  pane: InboxPane;
  setPane: React.Dispatch<React.SetStateAction<InboxPane>>;
  client: DataClient;
  openConfirm: (p: OpenConfirmPayload) => void;
  showToast: (message: string, tone: ToastTone) => void;
  onRefresh: () => void | Promise<void>;
}

export const InboxView: React.FC<Props> = ({
  inbox = [],
  draft = [],
  filterQuery,
  keyboardEnabled,
  pane,
  setPane,
  client,
  openConfirm,
  showToast,
  onRefresh
}) => {
  const [inboxIdx, setInboxIdx] = useState(0);
  const [draftIdx, setDraftIdx] = useState(0);

  const filteredInbox = useMemo(
    () =>
      inbox.filter(f =>
        matchesTextFilter(filterQuery, [f.name, f.size, new Date(f.mtime).toLocaleString()])
      ),
    [inbox, filterQuery]
  );

  const filteredDraft = useMemo(
    () =>
      draft.filter(f =>
        matchesTextFilter(filterQuery, [f.name, f.size, new Date(f.mtime).toLocaleString()])
      ),
    [draft, filterQuery]
  );

  const activeList = pane === 'inbox' ? filteredInbox : filteredDraft;
  const activeIdx = pane === 'inbox' ? inboxIdx : draftIdx;
  const setActiveIdx = pane === 'inbox' ? setInboxIdx : setDraftIdx;

  useEffect(() => {
    setInboxIdx(i => Math.min(i, Math.max(0, filteredInbox.length - 1)));
  }, [filteredInbox.length]);

  useEffect(() => {
    setDraftIdx(i => Math.min(i, Math.max(0, filteredDraft.length - 1)));
  }, [filteredDraft.length]);

  useInput((input, key) => {
    if (!keyboardEnabled) return;

    if (key.tab) {
      setPane(p => (p === 'inbox' ? 'draft' : 'inbox'));
      return;
    }

    if (input === 'i' || input === 'I') {
      const file = activeList[activeIdx];
      if (!file) {
        showToast('No file selected', 'error');
        return;
      }
      const dirLabel = pane === 'inbox' ? 'inbox/' : 'articles/';
      openConfirm({
        title: 'Run ingest',
        message: `mem-ai note create from file, then POST ingest:\n${dirLabel}${file.name}`,
        onConfirm: async () => {
          const r = await client.ingestMarkdownFile(file.name, pane === 'inbox' ? 'inbox' : 'draft');
          if (!r.success) {
            showToast(r.error ?? 'Ingest failed', 'error');
            return;
          }
          showToast('Ingest accepted (202)', 'success');
          await onRefresh();
        }
      });
      return;
    }

    if (key.downArrow || input === 'j') {
      if (activeList.length === 0) return;
      setActiveIdx(i => Math.min(activeList.length - 1, i + 1));
      return;
    }
    if (key.upArrow || input === 'k') {
      if (activeList.length === 0) return;
      setActiveIdx(i => Math.max(0, i - 1));
      return;
    }
  });

  const fq = filterQuery.trim();
  const matchHint = fq ? (
    <>
      <Text color="gray"> │ </Text>
      <Text dimColor>match: </Text>
      <Text color="magenta">{fq}</Text>
    </>
  ) : null;

  const renderFileRow = (f: InboxFile, i: number, isPane: InboxPane, selected: boolean) => (
    <Box key={`${isPane}-${f.name}-${i}`} justifyContent="space-between" paddingX={1}>
      <Text color={selected ? 'yellow' : 'white'} bold={selected}>
        {selected ? '▸ ' : '  '}
        {f.name}
      </Text>
      <Text color="gray">{isPane === 'inbox' ? `${Math.round(f.size / 1024)} KB` : new Date(f.mtime).toLocaleDateString()}</Text>
    </Box>
  );

  return (
    <Box flexDirection="column" height="100%" width="100%" flexGrow={1} minWidth={0}>
      <Box flexDirection="row" flexGrow={1} minHeight={0}>
        <Box width="50%" minWidth={0} borderStyle="single" flexDirection="column" borderColor={pane === 'inbox' ? 'cyan' : 'gray'}>
          <Box borderStyle="single" justifyContent="center">
            <Text bold color={pane === 'inbox' ? 'yellow' : 'gray'}>
              INBOX (Pending Ingest)
              {matchHint}
              {pane === 'inbox' ? ' ●' : ''}
            </Text>
          </Box>
          <Box flexDirection="column" paddingX={0} marginTop={1} flexGrow={1}>
            {filteredInbox.map((f, i) => renderFileRow(f, i, 'inbox', pane === 'inbox' && i === inboxIdx))}
            {filteredInbox.length === 0 && (
              <Text color="gray" paddingX={1}>
                {inbox.length === 0 ? 'No files in inbox' : 'No inbox files match filter'}
              </Text>
            )}
          </Box>
        </Box>
        <Box flexGrow={1} minWidth={0} borderStyle="single" flexDirection="column" borderColor={pane === 'draft' ? 'cyan' : 'gray'}>
          <Box borderStyle="single" justifyContent="center">
            <Text bold color={pane === 'draft' ? 'green' : 'gray'}>
              ARTICLES (Ingested)
              {matchHint}
              {pane === 'draft' ? ' ●' : ''}
            </Text>
          </Box>
          <Box flexDirection="column" paddingX={0} marginTop={1} flexGrow={1}>
            {filteredDraft.map((f, i) => renderFileRow(f, i, 'draft', pane === 'draft' && i === draftIdx))}
            {filteredDraft.length === 0 && (
              <Text color="gray" paddingX={1}>
                {draft.length === 0 ? 'No files in draft' : 'No draft files match filter'}
              </Text>
            )}
          </Box>
        </Box>
      </Box>
      {keyboardEnabled && (
        <Box paddingX={1} flexShrink={0}>
          <Text dimColor>h/l / ←/→: Inbox ↔ Draft (h on Inbox → sidebar) │ Tab │ j/k │ i: ingest file (mem-ai + API)</Text>
        </Box>
      )}
    </Box>
  );
};
