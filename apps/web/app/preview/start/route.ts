import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { resolvePublicPathForEntry } from "../../../lib/site/github-mdoc";

const BRANCH_COOKIE = "ks-branch";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const collection = url.searchParams.get("collection");
  const entry = url.searchParams.get("entry");
  const branch = url.searchParams.get("branch") ?? undefined;

  if (collection !== "docs" && collection !== "webClips") {
    return new Response("Invalid collection", { status: 400 });
  }
  if (!entry) {
    return new Response("Missing entry", { status: 400 });
  }

  const jar = await cookies();
  const token = jar.get("keystatic-gh-access-token")?.value;
  const target = await resolvePublicPathForEntry(collection, entry, branch, token);
  if (!target) {
    return new Response("Entry not found", { status: 404 });
  }

  if (branch) {
    (await draftMode()).enable();
    jar.set(BRANCH_COOKIE, branch, { path: "/", sameSite: "lax" });
  }

  const to = new URL(target, url.origin);
  redirect(to.toString());
}
