import { EdgeWorker } from "@pgflow/edge-worker";
import { CraftEpisodeSubmit } from "../../flows/craft-episode-submit.ts";
import { workerConnectionString } from "../_shared/worker-connection.ts";

EdgeWorker.start(CraftEpisodeSubmit, { connectionString: workerConnectionString() });
