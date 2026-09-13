import { createReader } from "@keystatic/core/reader";
import Link from "next/link";
import { getRepoRoot } from "../lib/repo-root";
import keystaticConfig from "../keystatic.config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const reader = createReader(getRepoRoot(), keystaticConfig);
  const [docs, clips] = await Promise.all([
    reader.collections.docs.list(),
    reader.collections.webClips.list(),
  ]);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <p style={{ color: "#666", margin: 0 }}>Phase 1 · local Keystatic</p>
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
        <li>Wiki documents: {docs.length}</li>
        <li>Web clips: {clips.length}</li>
        <li>Storage: {(process.env.NEXT_PUBLIC_KEYSTATIC_STORAGE ?? process.env.KEYSTATIC_STORAGE) === "github" ? "github" : "local"}</li>
      </ul>
    </main>
  );
}
