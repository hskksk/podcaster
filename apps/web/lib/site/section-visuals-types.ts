export type SectionVisualEntry = {
  sectionId: string;
  engine: string;
  engineVersion: string;
  alt: string;
  spec: unknown;
};

export type SectionVisualsContent = {
  sourceSha256: string;
  visuals: SectionVisualEntry[];
  bySectionId: Record<string, SectionVisualEntry>;
};
