import { after } from "next/server";
import { captureTokenFromEnv, captureTokenOk } from "../../../lib/capture/auth";
import {
  isCollection,
  isPodcastFlag,
  parseFrontmatter,
  setFrontmatterField,
  wrapMdoc,
  type CaptureCollection,
  type PodcastFlag,
} from "../../../lib/capture/frontmatter";
import {
  assertSafeContentPath,
  datedSlug,
  entryPath,
  shortHash,
} from "../../../lib/capture/path";
import { readCaptureFile, usesGithubCommit, writeCaptureFile } from "../../../lib/capture/commit";
import { githubCaptureReady } from "../../../lib/capture/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GITHUB_BUDGET_MS = 2000;

function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
}

function authorize(req: Request): Response | null {
  const token = captureTokenFromEnv();
  if (!token) {
    return new Response("Capture is not configured (CAPTURE_API_TOKEN)", { status: 503 });
  }
  if (!captureTokenOk(req.headers.get("authorization"), token)) return unauthorized();
  return null;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function parseJson(req: Request): Promise<Record<string, unknown> | Response> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return new Response("Invalid JSON", { status: 400 });
    }
    return body as Record<string, unknown>;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
}

function buildMdoc(opts: {
  title: string;
  content: string;
  url?: string;
  collection: CaptureCollection;
  podcast: PodcastFlag;
}): string {
  const now = new Date().toISOString();
  if (opts.collection === "docs") {
    return wrapMdoc(
      {
        title: opts.title,
        publishedAt: now.slice(0, 10),
        sourceUrl: opts.url,
        podcast: opts.podcast,
      },
      opts.content,
    );
  }
  return wrapMdoc(
    {
      title: opts.title,
      url: opts.url,
      clippedAt: now,
      podcast: opts.podcast,
    },
    opts.content,
  );
}

/** Ignore clippedAt / publishedAt so the same JSON body retries the same path. */
function sameClip(a: string, b: string): boolean {
  const left = parseFrontmatter(a);
  const right = parseFrontmatter(b);
  return (
    left.body.trim() === right.body.trim() &&
    (left.attrs.title ?? "") === (right.attrs.title ?? "") &&
    (left.attrs.url ?? left.attrs.sourceUrl ?? "") ===
      (right.attrs.url ?? right.attrs.sourceUrl ?? "") &&
    (left.attrs.podcast ?? "") === (right.attrs.podcast ?? "")
  );
}

async function resolvePath(
  collection: CaptureCollection,
  slug: string,
  content: string,
): Promise<{ path: string; existingSha?: string; identical: boolean }> {
  const primary = entryPath(collection, slug);
  const existing = await readCaptureFile(primary);
  if (!existing) return { path: primary, identical: false };
  if (sameClip(existing.text, content)) {
    return { path: primary, existingSha: existing.sha, identical: true };
  }
  const hashed = entryPath(collection, `${slug}-${shortHash(content)}`);
  const hashedExisting = await readCaptureFile(hashed);
  if (hashedExisting && sameClip(hashedExisting.text, content)) {
    return { path: hashed, existingSha: hashedExisting.sha, identical: true };
  }
  if (!hashedExisting) return { path: hashed, identical: false };
  const longer = entryPath(collection, `${slug}-${shortHash(content, 12)}`);
  const longerExisting = await readCaptureFile(longer);
  if (longerExisting && sameClip(longerExisting.text, content)) {
    return { path: longer, existingSha: longerExisting.sha, identical: true };
  }
  return { path: longer, existingSha: longerExisting?.sha, identical: false };
}

export async function POST(req: Request) {
  const denied = authorize(req);
  if (denied) return denied;

  const parsed = await parseJson(req);
  if (parsed instanceof Response) return parsed;

  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const content = typeof parsed.content === "string" ? parsed.content : "";
  if (!title) return new Response("Missing title", { status: 400 });
  if (!content.trim()) return new Response("Missing content", { status: 400 });

  const url = typeof parsed.url === "string" ? parsed.url.trim() : undefined;
  const slugOverride = typeof parsed.slug === "string" ? parsed.slug : undefined;
  const collectionRaw = typeof parsed.collection === "string" ? parsed.collection : "web-clips";
  const podcastRaw = typeof parsed.podcast === "string" ? parsed.podcast : "none";
  if (!isCollection(collectionRaw)) return new Response("Invalid collection", { status: 400 });
  if (!isPodcastFlag(podcastRaw)) return new Response("Invalid podcast flag", { status: 400 });

  // Capture never starts TTS. queued is allowed for later Phase 3 Actions, not the default.
  const collection = collectionRaw;
  const podcast = podcastRaw;
  const slug = datedSlug(title, slugOverride);
  const mdoc = buildMdoc({ title, content, url, collection, podcast });

  let resolved: { path: string; existingSha?: string; identical: boolean };
  try {
    resolved = await resolvePath(collection, slug, mdoc);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    console.error("capture resolve failed:", err);
    return new Response((err as Error).message || "Capture failed", { status });
  }

  if (resolved.identical) {
    return json({
      ok: true,
      path: resolved.path,
      sha: resolved.existingSha ?? "",
      collection,
      podcast,
    });
  }

  const message = `capture: add ${resolved.path}`;
  const write = writeCaptureFile({
    path: resolved.path,
    content: mdoc,
    message,
    existingSha: resolved.existingSha,
  });

  if (!usesGithubCommit()) {
    try {
      const result = await write;
      return json(
        { ok: true, path: result.path, sha: result.sha, collection, podcast },
        201,
      );
    } catch (err) {
      console.error("capture fs write failed:", err);
      return new Response((err as Error).message || "Capture failed", { status: 500 });
    }
  }

  if (!githubCaptureReady()) {
    return new Response("GITHUB_TOKEN (or CAPTURE_GITHUB_TOKEN) is not set", { status: 503 });
  }

  const started = Date.now();
  const raced = await Promise.race([
    write.then((r) => ({ done: true as const, r })).catch((err: unknown) => ({
      done: true as const,
      err,
    })),
    new Promise<{ done: false }>((resolve) =>
      setTimeout(() => resolve({ done: false }), GITHUB_BUDGET_MS),
    ),
  ]);

  if (!raced.done) {
    after(async () => {
      try {
        await write;
      } catch (err) {
        console.error("capture background commit failed:", err);
      }
    });
    return json(
      {
        ok: true,
        accepted: true,
        retryable: true,
        path: resolved.path,
        collection,
        podcast,
        waitedMs: Date.now() - started,
      },
      202,
    );
  }

  if ("err" in raced && raced.err) {
    const err = raced.err as { status?: number; message?: string };
    console.error("capture github write failed:", err);
    return new Response(err.message || "Capture failed", { status: err.status ?? 502 });
  }

  if (!("r" in raced) || !raced.r) {
    return new Response("Capture failed", { status: 502 });
  }

  return json(
    { ok: true, path: raced.r.path, sha: raced.r.sha, collection, podcast },
    201,
  );
}

export async function PATCH(req: Request) {
  const denied = authorize(req);
  if (denied) return denied;

  const parsed = await parseJson(req);
  if (parsed instanceof Response) return parsed;

  const rel = typeof parsed.path === "string" ? parsed.path.trim() : "";
  const podcastRaw = typeof parsed.podcast === "string" ? parsed.podcast : "";
  if (!rel || !assertSafeContentPath(rel)) {
    return new Response("Invalid path", { status: 400 });
  }
  if (!isPodcastFlag(podcastRaw)) return new Response("Invalid podcast flag", { status: 400 });

  let existing: { sha: string; text: string } | null;
  try {
    existing = await readCaptureFile(rel);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    console.error("capture patch read failed:", err);
    return new Response((err as Error).message || "Capture failed", { status });
  }
  if (!existing) return new Response("Not found", { status: 404 });

  const next = setFrontmatterField(existing.text, "podcast", podcastRaw);
  if (next === existing.text) {
    return json({ ok: true, path: rel, sha: existing.sha, podcast: podcastRaw });
  }

  try {
    const result = await writeCaptureFile({
      path: rel,
      content: next,
      message: `capture: set podcast=${podcastRaw} on ${rel}`,
      existingSha: usesGithubCommit() ? existing.sha : undefined,
    });
    return json({ ok: true, path: result.path, sha: result.sha, podcast: podcastRaw });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 502;
    console.error("capture patch write failed:", err);
    return new Response((err as Error).message || "Capture failed", { status });
  }
}
