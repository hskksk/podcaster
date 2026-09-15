import { FastMCP } from "fastmcp";
import { z } from "zod";
import { capturePatch, capturePost } from "./capture.js";
import { assertSafeContentPath, listMdocPaths, readMdoc, snippet } from "./content.js";

const server = new FastMCP({
  name: "podcaster",
  version: "0.1.0",
  instructions:
    "Git + Markdoc knowledge for podcaster. Reads use checkout or GITHUB_READ_TOKEN. Writes call Capture API (CAPTURE_API_TOKEN), never GITHUB_TOKEN. Capture does not start TTS.",
});

server.addTool({
  name: "search_docs",
  description: "Search content/docs and content/web-clips Markdoc. Read-only.",
  parameters: z.object({
    query: z.string().min(1).describe("Case-insensitive substring"),
  }),
  annotations: { readOnlyHint: true },
  execute: async ({ query }) => {
    const paths = await listMdocPaths();
    const hits: Array<{ path: string; snippet: string }> = [];
    for (const p of paths) {
      const text = await readMdoc(p);
      if (text.toLowerCase().includes(query.toLowerCase())) {
        hits.push({ path: p, snippet: snippet(text, query) });
      }
      if (hits.length >= 20) break;
    }
    return JSON.stringify({ query, count: hits.length, hits }, null, 2);
  },
});

server.addTool({
  name: "get_doc",
  description: "Fetch one Markdoc file under content/docs or content/web-clips. Read-only.",
  parameters: z.object({
    path: z
      .string()
      .describe("Repo-relative path, e.g. content/docs/{slug}/index.mdoc"),
  }),
  annotations: { readOnlyHint: true },
  execute: async ({ path }) => {
    if (!assertSafeContentPath(path)) {
      throw new Error("path must be content/docs/{slug}/index.mdoc or content/web-clips/{slug}/index.mdoc");
    }
    return await readMdoc(path);
  },
});

server.addTool({
  name: "write_clip",
  description:
    "Create a web-clip via Capture API (podcast: none). Does not call ingest or TTS. Requires CAPTURE_API_URL + CAPTURE_API_TOKEN.",
  parameters: z.object({
    title: z.string().min(1),
    content: z.string().min(1),
    url: z.string().optional(),
  }),
  execute: async ({ title, content, url }) => {
    const result = await capturePost({ title, content, url });
    return JSON.stringify(result, null, 2);
  },
});

server.addTool({
  name: "queue_podcast",
  description:
    "Set frontmatter podcast: queued via Capture PATCH. GitHub Actions ingest runs later. Does not start TTS itself. Requires CAPTURE_API_URL + CAPTURE_API_TOKEN.",
  parameters: z.object({
    path: z
      .string()
      .describe("Repo-relative path, e.g. content/web-clips/{slug}/index.mdoc"),
  }),
  execute: async ({ path }) => {
    if (!assertSafeContentPath(path)) {
      throw new Error("path must be content/docs/{slug}/index.mdoc or content/web-clips/{slug}/index.mdoc");
    }
    const result = await capturePatch(path, "queued");
    return JSON.stringify(result, null, 2);
  },
});

await server.start({ transportType: "stdio" });
