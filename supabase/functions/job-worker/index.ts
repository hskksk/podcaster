import { EdgeWorker } from "@pgflow/edge-worker";
import { RunJob } from "../../flows/run-job.ts";

EdgeWorker.start(RunJob);
