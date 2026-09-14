import { createReader } from "@keystatic/core/reader";
import Link from "next/link";
import { getRepoRoot } from "../lib/repo-root";
import { isGithubStorage } from "../lib/storage";
import keystaticConfig from "../keystatic.config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const storage = isGithubStorage() ? "github" : "local";
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
      <p style={{ color: "#666", margin: 0 }}>Phase 1 · Keystatic</p>
      <h1 style={{ marginTop: 8 }}>Podcaster knowledge base</h1>
      <p>
        Git + Markdoc is the source of truth. The public article site stays on
        GitHub Pages (`articles/`) until Phase 1b. Capture API and podcast ingest
        are not in this slice.
      </p>
      <p>
        <Link href="/keystatic">Open Keystatic admin</Link>
      </p>
      <ul>
        <li>Wiki documents: {storage === "github" ? "GitHub" : docs}</li>
        <li>Web clips: {storage === "github" ? "GitHub" : clips}</li>
        <li>Storage: {storage}</li>
      </ul>
      {listError ? (
        <p style={{ color: "#a33" }}>Could not list local collections: {listError}</p>
      ) : null}
    </main>
  );
}
