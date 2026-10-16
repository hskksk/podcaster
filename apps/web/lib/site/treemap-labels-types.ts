export type TreemapLabelEntry = {
  title?: string;
  subtitle?: string;
};

export type TreemapLabels = Record<string, TreemapLabelEntry>;

/** Matches markdoc-react treemap link types (inferLinks / buildTreemapLinks). */
export type TreemapLinkType =
  | "flow"
  | "seq"
  | "cause"
  | "evidence"
  | "apply"
  | "contrast"
  | "rec"
  | "end"
  | "ref";

export type TreemapLink = {
  from: string;
  to: string;
  type: TreemapLinkType;
  label?: string;
  reason?: string;
};

export type TreemapSidecarContent = {
  nodes: TreemapLabels;
  links?: TreemapLink[];
  /** Labels on inter-chapter flow arrows; length = chapter count − 1. */
  chapterFlow?: string[];
};

export const TREEMAP_LINK_TYPES: TreemapLinkType[] = [
  "flow",
  "seq",
  "cause",
  "evidence",
  "apply",
  "contrast",
  "rec",
  "end",
  "ref",
];
