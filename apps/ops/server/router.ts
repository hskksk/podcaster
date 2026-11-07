import type { IncomingMessage, ServerResponse } from "node:http";
import { requeueEpisode, publishEpisode, readMedia, parseScope } from "./actions.ts";
import { HttpError } from "./http-error.ts";
import { loadBoard, loadEpisode, loadSubscription } from "./queries.ts";

export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  try {
    if (req.method === "GET" && url.pathname === "/api/board") {
      return sendJson(res, 200, await loadBoard());
    }
    if (req.method === "GET" && url.pathname === "/api/subscription") {
      return sendJson(res, 200, await loadSubscription());
    }
    const episode = url.pathname.match(/^\/api\/episodes\/([^/]+)$/);
    if (req.method === "GET" && episode?.[1]) {
      return sendJson(res, 200, await loadEpisode(decodeURIComponent(episode[1])));
    }
    if (req.method === "GET" && url.pathname === "/api/media") {
      const file = await readMedia(url.searchParams.get("path") ?? "");
      res.writeHead(200, {
        "content-type": file.contentType,
        "cache-control": "private, max-age=60",
      });
      res.end(file.bytes);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/productions") {
      const body = await readJson(req);
      const episodeId = stringField(body, "episodeId");
      const scope = parseScope(isRecord(body) ? body.scope : undefined);
      return sendJson(res, 200, await requeueEpisode(episodeId, scope));
    }
    if (req.method === "POST" && url.pathname === "/api/publications") {
      const body = await readJson(req);
      return sendJson(res, 200, await publishEpisode(stringField(body, "episodeId")));
    }
    sendJson(res, 404, { error: "Not found." });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Request failed.";
    if (!(error instanceof HttpError)) console.error(error);
    sendJson(res, status, { error: message });
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > 32_000) throw new HttpError(413, "Body is too large.");
    chunks.push(buf);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Body must be JSON.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(body: unknown, key: string): string {
  if (!isRecord(body) || typeof body[key] !== "string" || body[key].length === 0) {
    throw new HttpError(400, `${key} is required.`);
  }
  return body[key];
}
