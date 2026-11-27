import assert from "node:assert/strict";
import { test } from "node:test";
import { vercelBranchUrlSlug, vercelPreviewBranchUrl } from "./knowledge-ref.ts";

const PROJECT = "podcaster";
const SCOPE = "hskksk-6496s-projects";

function previewUrl(podcasterGitBranch: string): string {
  return vercelPreviewBranchUrl({ projectName: PROJECT, scopeSlug: SCOPE, podcasterGitBranch });
}

// Expected values below were checked against live Vercel deployments (2026-11).
test("slug replaces slashes and drops underscores", () => {
  assert.equal(vercelBranchUrlSlug("feature/foo"), "feature-foo");
  assert.equal(vercelBranchUrlSlug("npm_and_yarn/foo"), "npmandyarn-foo");
  assert.equal(vercelBranchUrlSlug("Knowledges-Preview/Feature-Foo"), "knowledges-preview-feature-foo");
});

test("short branch keeps the plain label", () => {
  assert.equal(
    previewUrl("fix/foo"),
    "https://podcaster-git-fix-foo-hskksk-6496s-projects.vercel.app",
  );
});

test("long branch is truncated with the sha256 hash of git-<branch><project>", () => {
  assert.equal(
    previewUrl("knowledges-preview/opencode/issue51-20261127083041"),
    "https://podcaster-git-knowledges-preview-o-68f5ff-hskksk-6496s-projects.vercel.app",
  );
  assert.equal(
    previewUrl("dependabot/npm_and_yarn/packages/markdoc-react/npm_and_yarn-55eff801f2"),
    "https://podcaster-git-dependabot-npmandyar-3959f6-hskksk-6496s-projects.vercel.app",
  );
});

test("truncated labels stay within the 63 character DNS limit", () => {
  const label = previewUrl("knowledges-preview/opencode/issue51-20261127083041").replace(
    /^https:\/\//,
    "",
  ).replace(/\.vercel\.app$/, "");
  assert.equal(label.length, 63);
});
