import { EdgeWorker } from "@pgflow/edge-worker";
import { CraftEpisodeDownload } from "../../flows/craft-episode-download.ts";

EdgeWorker.start(CraftEpisodeDownload);
