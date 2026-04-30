import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { Sidebar } from './components/sidebar.js';
import { TopBar } from './components/topbar.js';
import { Footer } from './components/footer.js';
import { PipelineView } from './views/pipeline.js';
import { EpisodesView } from './views/episodes.js';
import { ArticlesView } from './views/articles.js';
import { AudioView } from './views/audio.js';
import { LogsView } from './views/logs.js';
import { InboxView } from './views/inbox.js';
import { ConfigView } from './views/config.js';
import { RssView } from './views/rss.js';
import { DataClient } from './data/client.js';

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

  const client = useMemo(() => new DataClient(isMock), [isMock]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const d = await client.fetchAll();
    setData(d);
    setLoading(false);
    if (d.episodes && d.episodes.length > 0) {
      setSelectedEpisodeId(d.episodes[0].id);
    }
  }, [client]); // client is now a dependency here

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

  const handleJumpToEpisode = (id: string) => {
    setSelectedEpisodeId(id);
    setView('episodes');
    setFocus('list'); // Focus the list pane when jumping to episode view
  };

  useInput((input, key) => {
    if (input === 'q') exit();
    if (input === 'r') {
      fetchData(); // Reload data on 'R' key press
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

    if (key.leftArrow || input === 'h') {
      if (view === 'pipeline') {
        if (focus === 'pipeline_0') setFocus('sidebar');
        else if (focus === 'pipeline_1') setFocus('pipeline_0');
        else if (focus === 'pipeline_2') setFocus('pipeline_1');
        else if (focus === 'pipeline_3') setFocus('pipeline_2');
        else setFocus('sidebar');
      } else {
        if (focus === 'detail') setFocus('list');
        else if (focus === 'list') setFocus('sidebar');
      }
    }
    if (key.rightArrow || input === 'l') {
      if (view === 'pipeline') {
        if (focus === 'sidebar') setFocus('pipeline_0');
        else if (focus === 'pipeline_0') setFocus('pipeline_1');
        else if (focus === 'pipeline_1') setFocus('pipeline_2');
        else if (focus === 'pipeline_2') setFocus('pipeline_3');
      } else {
        if (focus === 'sidebar') setFocus('list');
        else if (focus === 'list') setFocus('detail');
      }
    }
  });

  if (loading) {
    return <Text>Loading...</Text>;
  }

  return (
    <Box flexDirection="column" height={dimensions.rows || 24}>
      <TopBar view={view} isMock={isMock} />
      <Box flexGrow={1} minHeight={0}>
        <Box flexShrink={0} flexGrow={0} width={22}>
          <Sidebar currentView={view} onSelect={setView} focus={focus === 'sidebar'} />
        </Box>
        <Box flexGrow={1} minHeight={0}>
          {view === 'pipeline' && <PipelineView data={data} focus={focus} onSelectEpisode={handleJumpToEpisode} />}
          {view === 'episodes' && <EpisodesView episodes={data.episodes} config={data.config} focus={focus as any} client={client} rows={dimensions.rows} selectedId={selectedEpisodeId} onSelectId={setSelectedEpisodeId} />}
          {view === 'articles' && <ArticlesView articles={data.articles} focus={focus as any} rows={dimensions.rows} columns={dimensions.columns} />}
          {view === 'audio' && <AudioView audioFiles={data.audioFiles} isFocused={focus !== 'sidebar'} columns={dimensions.columns} />}
          {view === 'logs' && <LogsView logs={data.logs} isFocused={focus !== 'sidebar'} rows={dimensions.rows} />}
          {view === 'inbox' && <InboxView inbox={data.inbox} draft={data.draft} />}
          {view === 'config' && <ConfigView config={data.config} />}
          {view === 'rss' && <RssView episodes={data.episodes} config={data.config} />}
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};
