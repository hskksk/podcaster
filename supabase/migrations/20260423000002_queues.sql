-- Enable pgmq extension
create extension if not exists pgmq;

-- Create queues for each pipeline stage
select pgmq.create('script-queue');
select pgmq.create('audio-queue');
select pgmq.create('rss-queue');
