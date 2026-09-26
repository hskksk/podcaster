import { cookies, draftMode } from "next/headers";

const BRANCH_COOKIE = "ks-branch";

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (req.headers.get("origin") !== url.origin) {
    return new Response("Invalid origin", { status: 400 });
  }
  const referrer = req.headers.get("Referer");
  if (!referrer) {
    return new Response("Missing Referer", { status: 400 });
  }

  (await draftMode()).disable();
  (await cookies()).delete(BRANCH_COOKIE);
  return Response.redirect(referrer, 303);
}
