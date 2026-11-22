#!/usr/bin/env tsx
/**
 * Fetch private knowledge corpus into a local dir (not committed).
 * Defaults: shallow (depth 1), blob:none filter, sparse paths.
 *
 *   pnpm knowledge:checkout
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const repoRoot = path.resolve(import.meta.dirname, "..");

type LockFile = { repo?: string; sha?: string; ref?: string };

function readLock(): LockFile | null {
  const lockPath = path.join(repoRoot, "knowledge.lock.json");
  if (!existsSync(lockPath)) return null;
  try {
    return JSON.parse(readFileSync(lockPath, "utf8")) as LockFile;
  } catch {
    return null;
  }
}

function envRef(lock: LockFile | null): string {
  return (
    process.env.KNOWLEDGE_GIT_REF?.trim() ||
    lock?.sha?.trim() ||
    lock?.ref?.trim() ||
    "main"
  );
}

function envRepo(lock: LockFile | null): string {
  const fromEnv = process.env.KNOWLEDGE_GITHUB_REPO?.trim();
  if (fromEnv) return fromEnv;
  if (lock?.repo) return lock.repo;
  throw new Error("KNOWLEDGE_GITHUB_REPO is required (or knowledge.lock.json repo)");
}

function checkoutDir(): string {
  return path.resolve(
    process.env.CONTENT_ROOT?.trim() || path.join(repoRoot, ".knowledge-checkout"),
  );
}

function sparsePaths(): string[] {
  const custom = process.env.KNOWLEDGE_SPARSE_PATHS?.trim();
  if (custom) return custom.split(",").map((p) => p.trim()).filter(Boolean);
  const paths = ["content", "styles"];
  if (process.env.KNOWLEDGE_INCLUDE_NOTES !== "0") paths.push("notes");
  return paths;
}

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", env: process.env });
}

function runGitInherit(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "inherit", env: process.env });
}

function authUrl(owner: string, repo: string, token: string): string {
  return `https://x-access-token:${encodeURIComponent(token)}@github.com/${owner}/${repo}.git`;
}

function isSha(ref: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(ref);
}

function checkoutSparseShallow(opts: {
  owner: string;
  repo: string;
  token: string;
  ref: string;
  dest: string;
  depth: number;
  filterBlobs: boolean;
}): void {
  const { owner, repo, token, ref, dest, depth, filterBlobs } = opts;
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  mkdirSync(path.dirname(dest), { recursive: true });

  const remote = authUrl(owner, repo, token);
  const cloneArgs = ["clone", "--depth", String(depth), "--sparse", "--no-checkout"];
  if (filterBlobs) cloneArgs.push("--filter=blob:none");
  cloneArgs.push(remote, dest);

  runGitInherit(repoRoot, cloneArgs);

  runGitInherit(dest, ["sparse-checkout", "set", ...sparsePaths()]);

  if (isSha(ref)) {
    runGitInherit(dest, ["fetch", "--depth", String(depth), "origin", ref]);
    runGitInherit(dest, ["checkout", "FETCH_HEAD"]);
  } else {
    runGitInherit(dest, ["fetch", "--depth", String(depth), "origin", ref]);
    runGitInherit(dest, ["checkout", "FETCH_HEAD"]);
  }
}

function checkoutArchive(opts: {
  owner: string;
  repo: string;
  token: string;
  ref: string;
  dest: string;
}): void {
  const { owner, repo, token, ref, dest } = opts;
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });

  const url = `https://api.github.com/repos/${owner}/${repo}/tarball/${encodeURIComponent(ref)}`;
  const tarball = path.join(repoRoot, `.knowledge-tarball-${process.pid}.tar.gz`);
  execFileSync(
    "curl",
    [
      "-fsSL",
      "-H",
      `Authorization: Bearer ${token}`,
      "-H",
      "Accept: application/vnd.github+json",
      "-o",
      tarball,
      url,
    ],
    { stdio: "inherit" },
  );
  execFileSync("tar", ["-xzf", tarball, "-C", dest, "--strip-components=1"], { stdio: "inherit" });
  rmSync(tarball, { force: true });
}

function checkoutRequired(): boolean {
  if (process.env.KNOWLEDGE_CHECKOUT_SKIP === "1") return false;
  if (process.env.KNOWLEDGE_CHECKOUT_REQUIRED === "1") return true;
  return process.env.VERCEL === "1";
}

function failCheckout(message: string): never {
  throw new Error(`[knowledge] ${message}`);
}

function main(): void {
  if (process.env.KNOWLEDGE_CHECKOUT_SKIP === "1") {
    console.log("[knowledge] KNOWLEDGE_CHECKOUT_SKIP=1 — skipping checkout");
    return;
  }

  const required = checkoutRequired();
  const lock = readLock();
  let fullRepo: string;
  try {
    fullRepo = envRepo(lock);
  } catch {
    if (required) {
      failCheckout(
        "KNOWLEDGE_GITHUB_REPO unset and knowledge.lock.json missing repo (required on Vercel)",
      );
    }
    console.warn("[knowledge] KNOWLEDGE_GITHUB_REPO unset — skipping checkout");
    return;
  }
  const [owner, repo] = fullRepo.split("/");
  if (!owner || !repo) throw new Error(`Invalid KNOWLEDGE_GITHUB_REPO: ${fullRepo}`);

  const token = process.env.KNOWLEDGE_GITHUB_TOKEN?.trim();
  if (!token) {
    if (required) {
      failCheckout("KNOWLEDGE_GITHUB_TOKEN unset (required on Vercel / KNOWLEDGE_CHECKOUT_REQUIRED)");
    }
    console.warn("[knowledge] KNOWLEDGE_GITHUB_TOKEN unset — skipping checkout");
    return;
  }

  const ref = envRef(lock);
  const dest = checkoutDir();
  const depth = Math.max(1, Number(process.env.KNOWLEDGE_DEPTH ?? "1"));
  const method = (process.env.KNOWLEDGE_CHECKOUT_METHOD ?? "sparse-shallow").toLowerCase();
  const filterBlobs = process.env.KNOWLEDGE_FILTER_BLOBS !== "0";

  console.log(
    `[knowledge] method=${method} ref=${ref} depth=${depth} filterBlobs=${filterBlobs} paths=${sparsePaths().join(",")}`,
  );

  if (method === "archive") {
    checkoutArchive({ owner, repo, token, ref, dest });
  } else {
    checkoutSparseShallow({ owner, repo, token, ref, dest, depth, filterBlobs });
  }

  const head = runGit(dest, ["rev-parse", "HEAD"]).trim();
  console.log(`[knowledge] ok CONTENT_ROOT=${dest} sha=${head}`);
}

main();