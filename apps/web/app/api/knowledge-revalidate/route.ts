import { revalidatePath, revalidateTag } from "next/cache";
import { KNOWLEDGE_CACHE_TAG } from "../../../lib/knowledge/constants";
import { knowledgeRevalidateOk, knowledgeRevalidateSecret } from "../../../lib/knowledge/revalidate-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  /** Revalidate tagged corpus caches (default). */
  tag?: string;
  /** Optional extra paths (e.g. `/juken/kokugo-choice/2026-01-01-01`). */
  paths?: string[];
  /** When true, also revalidate layout shell routes. */
  layouts?: boolean;
};

function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request): Promise<Response> {
  if (!knowledgeRevalidateSecret()) {
    return new Response("KNOWLEDGE_REVALIDATE_SECRET is not configured", { status: 503 });
  }
  if (!knowledgeRevalidateOk(req.headers.get("authorization"))) return unauthorized();

  let body: Body = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as Body;
  } catch {
    return Response.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const tag = body.tag?.trim() || KNOWLEDGE_CACHE_TAG;
  revalidateTag(tag);

  const paths = body.paths?.filter((p) => typeof p === "string" && p.startsWith("/")) ?? [];
  for (const p of paths) revalidatePath(p);

  if (body.layouts !== false) {
    for (const p of ["/", "/juken", "/podcast", "/podcast/search", "/juken/search"]) {
      revalidatePath(p);
    }
  }

  return Response.json({
    ok: true,
    tag,
    paths: paths.length > 0 ? paths : undefined,
    note: "HTML refreshes on next request; Pagefind still needs a full Vercel build.",
  });
}