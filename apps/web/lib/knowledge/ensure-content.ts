import "server-only";

import fs from "node:fs";
import path from "node:path";
import {
  extractKnowledgeArchive,
  knowledgeContentPresent,
  knowledgeGithubRef,
} from "../../../../scripts/lib/knowledge-archive";
import { getContentRoot, setRuntimeContentRoot } from "../../../../scripts/lib/content-paths";
import { resetJukenCoursesCache } from "../juken/catalog";
import { resetKokugoChoiceSetsCache } from "../juken/kokugo-choice/catalog";
import { resetPublicDocsCache } from "../site/docs";
import { resetPublicWebClipsCache } from "../site/web-clips";

let preparePromise: Promise<void> | null = null;
let preparedRef: string | null = null;

function runtimeCheckoutDir(ref: string): string {
  const base = process.env.VERCEL ? "/tmp" : path.join(getContentRoot(), "..");
  const safe = ref.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 64);
  return path.join(base, `.knowledge-runtime-${safe}`);
}

function shouldFetchRuntimeKnowledge(root: string): boolean {
  if (process.env.KNOWLEDGE_RUNTIME_FETCH === "0") return false;
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  if (knowledgeContentPresent(root)) return false;
  return process.env.VERCEL === "1";
}

/**
 * Ensures Markdoc trees exist before reading from disk.
 * Build machines run prebuild checkout; Vercel ISR fetches a tarball on first use.
 */
export async function ensureKnowledgeContentForRender(): Promise<void> {
  const root = getContentRoot();
  if (!shouldFetchRuntimeKnowledge(root)) return;

  const ref = knowledgeGithubRef();
  if (preparedRef === ref && knowledgeContentPresent(root)) return;
  if (preparePromise) {
    await preparePromise;
    return;
  }

  preparePromise = (async () => {
    const dest = runtimeCheckoutDir(ref);
    if (!knowledgeContentPresent(dest)) {
      console.log(`[knowledge] runtime archive ref=${ref} dest=${dest}`);
      extractKnowledgeArchive(dest);
    }
    setRuntimeContentRoot(dest);
    preparedRef = ref;
    resetJukenCoursesCache();
    resetKokugoChoiceSetsCache();
    resetPublicDocsCache();
    resetPublicWebClipsCache();
  })();

  try {
    await preparePromise;
  } finally {
    preparePromise = null;
  }
}