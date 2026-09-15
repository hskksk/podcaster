import type { CaptureCollection, PodcastFlag } from "./frontmatter";

export type CaptureWriteResult = {
  path: string;
  sha: string;
  committed: boolean;
};

export type CapturePostBody = {
  title: string;
  content: string;
  url?: string;
  slug?: string;
  collection?: CaptureCollection;
  podcast?: PodcastFlag;
};

export type CapturePatchBody = {
  path: string;
  podcast: PodcastFlag;
};
