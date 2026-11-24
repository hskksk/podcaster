import "server-only";

export {
  getContentRoot,
  getMonorepoRoot,
  aiPodcastDir,
  notesDir,
  jukenDir,
  historyMapGeoPath,
  LEGACY_CLIPS_REL,
  AI_PODCAST_REL,
  LEGACY_DOCS_REL,
} from "../../../scripts/lib/content-paths";

/** @deprecated Use getContentRoot() for Markdoc trees. */
export { getContentRoot as getRepoRoot } from "../../../scripts/lib/content-paths";