export type StageKind =
  | "done"
  | "waiting"
  | "running"
  | "failed"
  | "idle"
  | "live"
  | "reused"
  | "off";

export type Stage = {
  kind: StageKind;
  label: string;
  detail: string;
};

export type FailureView = {
  stage: string | null;
  reason: string;
  failedJobId: string | null;
  at: string | null;
};

export type BoardEpisode = {
  id: string;
  title: string;
  path: string | null;
  updatedAt: string;
  scope: string | null;
  trigger: string | null;
  overviewStatus: string;
  stages: {
    script: Stage;
    audio: Stage;
    artwork: Stage;
    publish: Stage;
  };
  failure: FailureView | null;
  stall: string | null;
  published: boolean;
  active: boolean;
  assembled: boolean;
  attention: "failed" | "stalled" | null;
  productionId: string | null;
  audioPath: string | null;
  imagePath: string | null;
};

export type SubscriptionSummary = {
  processedPosition: number;
  latestPosition: number;
  lag: number;
  leaseExpired: boolean;
  stuck: { position: number; error: string | null } | null;
};

export type BoardResponse = {
  projectRef: string;
  episodes: BoardEpisode[];
  subscription: SubscriptionSummary;
  fetchedAt: string;
};

export type AttemptView = {
  jobType: string;
  status: string;
  attempt: string;
  startedAt: string | null;
  finishedAt: string | null;
  note: string;
};

export type EventView = {
  position: number;
  at: string;
  type: string;
  actor: string;
  note: string;
};

export type EpisodeDetail = {
  attempts: AttemptView[];
  events: EventView[];
};

export type SubscriptionResponse = SubscriptionSummary & {
  pending: Array<{
    position: number;
    type: string;
    streamType: string;
    actor: string;
    at: string;
  }>;
  failures: Array<{
    position: number;
    failedAt: string;
    error: string;
  }>;
};

export type ProductionScope = "full" | "audio" | "artwork";
