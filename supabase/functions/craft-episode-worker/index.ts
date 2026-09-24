import { EdgeWorker } from "@pgflow/edge-worker";
import { CraftEpisodeSubmit } from "../../flows/craft-episode-submit.ts";

EdgeWorker.start(CraftEpisodeSubmit);
