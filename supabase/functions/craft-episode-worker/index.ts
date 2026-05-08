import { EdgeWorker } from "@pgflow/edge-worker";
import { CraftEpisode } from '../../flows/craft-episode.ts';

EdgeWorker.start(CraftEpisode);
