import { createReader } from "@keystatic/core/reader";
import Link from "next/link";
import { hasGithubAppCreds } from "../lib/github-app";
import { getRepoRoot } from "../lib/repo-root";
import { isGithubStorage } from "../lib/storage";
import keystaticConfig from "../keystatic.config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const storage = isGithubStorage() ? "github" : "local";
  const githubReady = storage === "github" && hasGithubAppCreds();
  let docs = 0;
  let clips = 0;
  let listError: string | null = null;

  if (storage === "local") {
    try {
      const reader = createReader(getRepoRoot(), keystaticConfig);
      const [docSlugs, clipSlugs] = await Promise.all([
        reader.collections.docs.list(),
        reader.collections.webClips.list(),
      ]);
      docs = docSlugs.length;
      clips = clipSlugs.length;
    } catch (err) {
      listError = err instanceof Error ? err.message : "Could not read collections";
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <p style={{ color: "#666", margin: 0 }}>Phase 2 · Capture</p>
      <h1 style={{ marginTop: 8 }}>Podcaster knowledge base</h1>
      <p>
        Git + Markdoc is the source of truth. On Vercel, Keystatic uses GitHub
        storage so edits become commits. Locally, `pnpm web:dev` still writes
        `content/` on disk. <code>POST /api/capture</code> commits a web-clip
        and does not start TTS.
      </p>
      <p>
        <Link href="/keystatic">Open Keystatic admin</Link>
      </p>
      <ul>
        <li>Wiki documents: {storage === "github" ? "GitHub" : docs}</li>
        <li>Web clips: {storage === "github" ? "GitHub" : clips}</li>
        <li>Storage: {storage}</li>
      </ul>
      {storage === "github" && !githubReady ? (
        <section
          style={{
            marginTop: 24,
            padding: 16,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 8,
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Finish GitHub App setup</h2>
          <ol>
            <li>
              Locally: <code>pnpm web:github</code> then open{" "}
              <Link href="/keystatic/setup">/keystatic/setup</Link> (or click
              Log in with GitHub — in dev that page is next)
            </li>
            <li>Create the GitHub App on that setup screen</li>
            <li>
              Copy <code>KEYSTATIC_GITHUB_CLIENT_ID</code>,{" "}
              <code>KEYSTATIC_GITHUB_CLIENT_SECRET</code>,{" "}
              <code>KEYSTATIC_SECRET</code>, and{" "}
              <code>NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG</code> into Vercel →
              Project → Settings → Environment Variables
            </li>
            <li>
              Add callback{" "}
              <code>/api/keystatic/github/oauth/callback</code> on this
              deployment&apos;s origin if the App wizard did not
            </li>
            <li>Redeploy</li>
          </ol>
        </section>
      ) : null}
      {listError ? (
        <p style={{ color: "#a33" }}>Could not list local collections: {listError}</p>
      ) : null}
    </main>
  );
}
