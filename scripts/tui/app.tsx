import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { Sidebar } from './components/sidebar.js';
import { TopBar } from './components/topbar.js';
import { Footer } from './components/footer.js';
import { HelpModal } from './components/help-modal.js';
import { FilterInput } from './components/filter-input.js';
import { CommandPalette } from './components/command-palette.js';
import { ConfirmModal } from './components/confirm-modal.js';
import { Toast, ToastTone } from './components/toast.js';
import { PipelineView } from './views/pipeline.js';
import { EpisodesView } from './views/episodes.js';
import { ArticlesView } from './views/articles.js';
import { AudioView } from './views/audio.js';
import { LogsView } from './views/logs.js';
import { InboxView } from './views/inbox.js';
import { ConfigView } from './views/config.js';
import { RssView } from './views/rss.js';
import { DataClient } from './data/client.js';
import { filterPaletteCommands } from './commands/registry.js';

type UiMode = 'normal' | 'help' | 'filter' | 'command' | 'confirm';

interface ConfirmState {
  title: string;
  message: string;
  onConfirm: () => void;
}

interface Props {
  isMock: boolean;
}

export const App: React.FC<Props> = ({ isMock }) => {
  const { exit } = useApp();
  const [view, setView] = useState('pipeline');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [focus, setFocus] = useState<'sidebar' | 'list' | 'detail' | 'pipeline_0' | 'pipeline_1' | 'pipeline_2' | 'pipeline_3'>('sidebar');
  const [dimensions, setDimensions] = useState({
    rows: process.stdout.rows,
    columns: process.stdout.columns
  });

  const [uiMode, setUiMode] = useState<UiMode>('normal');
  const [globalFilter, setGlobalFilter] = useState('');
  const [commandDraft, setCommandDraft] = useState('');
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
  /** Snapshot when opening `/` filter mode; Esc restores this. */
  const filterBaselineRef = useRef('');
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const client = useMemo(() => new DataClient(isMock), [isMock]);
  const keyboardEnabled = uiMode === 'normal';

  const inputContextRef = useRef({
    uiMode,
    confirmState,
    globalFilter,
    view,
    focus,
    commandDraft,
    commandSelectedIndex
  });
  inputContextRef.current = {
    uiMode,
    confirmState,
    globalFilter,
    view,
    focus,
    commandDraft,
    commandSelectedIndex
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const d = await client.fetchAll();
    setData(d);
    setLoading(false);
    if (d.episodes && d.episodes.length > 0) {
      setSelectedEpisodeId(d.episodes[0].id);
    }
  }, [client]);

  useEffect(() => {
    const onResize = () => {
      setDimensions({
        rows: process.stdout.rows,
        columns: process.stdout.columns
      });
    };
    process.stdout.on('resize', onResize);

    fetchData();

    return () => {
      process.stdout.off('resize', onResize);
    };
  }, [fetchData]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  const handleJumpToEpisode = (id: string) => {
    setSelectedEpisodeId(id);
    setView('episodes');
    setFocus('list');
  };

  const runCommandLine = useCallback(
    (line: string) => {
      const cmd = line.toLowerCase();
      if (cmd === '') return;
      if (cmd === 'reload') {
        void fetchData().then(() => {
          setToast({ message: 'Data reloaded', tone: 'success' });
        });
        return;
      }
      if (cmd === 'target local') {
        setToast({ message: 'TARGET=local (mock)', tone: 'info' });
        return;
      }
      if (cmd === 'target remote') {
        setToast({ message: 'TARGET=remote (mock)', tone: 'info' });
        return;
      }
      if (cmd === 'demo confirm') {
        setConfirmState({
          title: 'Dummy confirm',
          message: 'Phase 1 placeholder. Proceed?',
          onConfirm: () => setToast({ message: 'Confirmed', tone: 'success' })
        });
        setUiMode('confirm');
        return;
      }
      setToast({ message: `Unknown command: ${line}`, tone: 'error' });
    },
    [fetchData]
  );

  useInput((input, key) => {
    const ctx = inputContextRef.current;

    if (key.escape) {
      if (ctx.uiMode === 'normal') return;
      if (ctx.uiMode === 'confirm') {
        setConfirmState(null);
        setUiMode('normal');
        return;
      }
      if (ctx.uiMode === 'filter') {
        setGlobalFilter(filterBaselineRef.current);
        setUiMode('normal');
        return;
      }
      if (ctx.uiMode === 'command') {
        setCommandDraft('');
        setCommandSelectedIndex(0);
        setUiMode('normal');
        return;
      }
      setUiMode('normal');
      return;
    }

    if (ctx.uiMode === 'help') {
      return;
    }

    if (ctx.uiMode === 'confirm' && ctx.confirmState) {
      if (key.return) {
        const fn = ctx.confirmState.onConfirm;
        setConfirmState(null);
        setUiMode('normal');
        fn();
      }
      return;
    }

    if (ctx.uiMode === 'filter') {
      if (key.return) {
        setGlobalFilter(g => g.trim());
        setUiMode('normal');
        return;
      }
      if (key.backspace || key.delete) {
        setGlobalFilter(g => g.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setGlobalFilter(g => g + input);
      }
      return;
    }

    if (ctx.uiMode === 'command') {
      const draft = ctx.commandDraft;
      const filtered = filterPaletteCommands(draft);
      const maxIdx = Math.max(0, filtered.length - 1);

      if (key.return) {
        const sel = Math.min(ctx.commandSelectedIndex, maxIdx);
        const toRun = filtered.length > 0 ? filtered[sel].id : draft.trim();
        setCommandDraft('');
        setCommandSelectedIndex(0);
        setUiMode('normal');
        runCommandLine(toRun);
        return;
      }
      if (key.upArrow) {
        if (filtered.length === 0) return;
        setCommandSelectedIndex(prev => Math.max(0, Math.min(prev, maxIdx) - 1));
        return;
      }
      if (key.downArrow) {
        if (filtered.length === 0) return;
        setCommandSelectedIndex(prev => Math.min(maxIdx, Math.min(prev, maxIdx) + 1));
        return;
      }
      if (key.backspace || key.delete) {
        setCommandDraft(d => d.slice(0, -1));
        setCommandSelectedIndex(0);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setCommandDraft(d => d + input);
        setCommandSelectedIndex(0);
        return;
      }
      return;
    }

    if (input === 'q') {
      exit();
      return;
    }
    if (input === 'r') {
      void fetchData();
      return;
    }
    if (input === '1') setView('pipeline');
    if (input === '2') setView('episodes');
    if (input === '3') setView('articles');
    if (input === '4') setView('audio');
    if (input === '5') setView('logs');
    if (input === '6') setView('inbox');
    if (input === '7') setView('config');
    if (input === '8') setView('rss');

    const { view: v, focus: f } = inputContextRef.current;

    if (key.leftArrow || input === 'h') {
      if (v === 'pipeline') {
        if (f === 'pipeline_0') setFocus('sidebar');
        else if (f === 'pipeline_1') setFocus('pipeline_0');
        else if (f === 'pipeline_2') setFocus('pipeline_1');
        else if (f === 'pipeline_3') setFocus('pipeline_2');
        else setFocus('sidebar');
      } else {
        if (f === 'detail') setFocus('list');
        else if (f === 'list') setFocus('sidebar');
      }
    }
    if (key.rightArrow || input === 'l') {
      if (v === 'pipeline') {
        if (f === 'sidebar') setFocus('pipeline_0');
        else if (f === 'pipeline_0') setFocus('pipeline_1');
        else if (f === 'pipeline_1') setFocus('pipeline_2');
        else if (f === 'pipeline_2') setFocus('pipeline_3');
      } else {
        if (f === 'sidebar') setFocus('list');
        else if (f === 'list') setFocus('detail');
      }
    }

    if (input === '/') {
      filterBaselineRef.current = inputContextRef.current.globalFilter;
      setUiMode('filter');
      return;
    }
    if (input === ':') {
      setUiMode('command');
      setCommandDraft('');
      setCommandSelectedIndex(0);
      return;
    }
    if (input === '?') {
      setUiMode('help');
    }
  });

  if (loading) {
    return <Text>Loading...</Text>;
  }

  return (
    <Box flexDirection="column" height={dimensions.rows || 24}>
      <TopBar view={view} isMock={isMock} filterQuery={globalFilter} />
      <Box flexDirection="column" flexGrow={1} minHeight={0}>
        <Box flexGrow={1} minHeight={0} flexDirection="row">
          <Box flexShrink={0} flexGrow={0} width={22}>
            <Sidebar currentView={view} onSelect={setView} focus={focus === 'sidebar'} keyboardEnabled={keyboardEnabled} />
          </Box>
          <Box flexGrow={1} minHeight={0}>
            {view === 'pipeline' && (
              <PipelineView
                data={data}
                focus={focus}
                onSelectEpisode={handleJumpToEpisode}
                keyboardEnabled={keyboardEnabled}
                filterQuery={globalFilter}
              />
            )}
            {view === 'episodes' && (
              <EpisodesView
                episodes={data.episodes}
                config={data.config}
                focus={focus as any}
                client={client}
                rows={dimensions.rows}
                selectedId={selectedEpisodeId}
                onSelectId={setSelectedEpisodeId}
                keyboardEnabled={keyboardEnabled}
                filterQuery={globalFilter}
              />
            )}
            {view === 'articles' && (
              <ArticlesView
                articles={data.articles}
                focus={focus as any}
                rows={dimensions.rows}
                columns={dimensions.columns}
                filterQuery={globalFilter}
                keyboardEnabled={keyboardEnabled}
              />
            )}
            {view === 'audio' && (
              <AudioView
                audioFiles={data.audioFiles}
                isFocused={focus !== 'sidebar'}
                columns={dimensions.columns}
                keyboardEnabled={keyboardEnabled}
                filterQuery={globalFilter}
              />
            )}
            {view === 'logs' && (
              <LogsView logs={data.logs} isFocused={focus !== 'sidebar'} rows={dimensions.rows} filterQuery={globalFilter} keyboardEnabled={keyboardEnabled} />
            )}
            {view === 'inbox' && <InboxView inbox={data.inbox} draft={data.draft} filterQuery={globalFilter} />}
            {view === 'config' && <ConfigView config={data.config} filterQuery={globalFilter} />}
            {view === 'rss' && <RssView episodes={data.episodes} config={data.config} />}
          </Box>
        </Box>
        {uiMode === 'help' && <HelpModal />}
        {uiMode === 'filter' && <FilterInput value={globalFilter} />}
        {uiMode === 'command' && <CommandPalette draft={commandDraft} selectedIndex={commandSelectedIndex} />}
        {uiMode === 'confirm' && confirmState && <ConfirmModal title={confirmState.title} message={confirmState.message} />}
        {toast && <Toast message={toast.message} tone={toast.tone} />}
      </Box>
      <Footer />
    </Box>
  );
};
