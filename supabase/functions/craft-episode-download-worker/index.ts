import { EdgeWorker } from "@pgflow/edge-worker";
import { CraftEpisodeDownload } from "../../flows/craft-episode-download.ts";
import { workerConnectionString } from "../_shared/worker-connection.ts";

EdgeWorker.start(CraftEpisodeDownload, { connectionString: workerConnectionString() });
