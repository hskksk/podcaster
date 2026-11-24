import "server-only";

import { unstable_cache } from "next/cache";
import { loadJukenCourses } from "../juken/catalog";
import { loadKokugoChoiceSets } from "../juken/kokugo-choice/catalog";
import { loadPublicDocs } from "../site/docs";
import { loadPublicWebClips } from "../site/web-clips";
import { KNOWLEDGE_CACHE_TAG } from "./constants";
import { ensureKnowledgeContentForRender } from "./ensure-content";

const cacheOpts = { tags: [KNOWLEDGE_CACHE_TAG] as string[] };

export const getJukenCoursesForRender = unstable_cache(
  async () => {
    await ensureKnowledgeContentForRender();
    return loadJukenCourses();
  },
  ["knowledge-juken-courses-v2"],
  cacheOpts,
);

export const getKokugoChoiceSetsForRender = unstable_cache(
  async () => {
    await ensureKnowledgeContentForRender();
    return loadKokugoChoiceSets();
  },
  ["knowledge-kokugo-choice-v2"],
  cacheOpts,
);

export const getPublicDocsForRender = unstable_cache(
  async () => {
    await ensureKnowledgeContentForRender();
    return loadPublicDocs();
  },
  ["knowledge-public-docs-v2"],
  cacheOpts,
);

export const getPublicWebClipsForRender = unstable_cache(
  async () => {
    await ensureKnowledgeContentForRender();
    return loadPublicWebClips();
  },
  ["knowledge-web-clips-v2"],
  cacheOpts,
);