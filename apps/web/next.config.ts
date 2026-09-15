import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootCandidate = path.join(appDir, "../..");
const repoRoot = fs.existsSync(path.join(repoRootCandidate, "pnpm-workspace.yaml"))
  ? repoRootCandidate
  : appDir;

const nextConfig: NextConfig = {
  transpilePackages: ["@keystatic/core", "@keystatic/next"],
  async redirects() {
    return [
      {
        source: "/articles/:slug.html",
        destination: "/articles/:slug",
        permanent: true,
      },
    ];
  },
};

// Standalone (Docker / Railway) needs the monorepo root in the file trace.
// Vercel’s Next.js builder already runs inside apps/web — do not set
// outputFileTracingRoot there or it looks for apps/web/apps/web/.next.
if (process.env.KEYSTATIC_STANDALONE === "1") {
  nextConfig.output = "standalone";
  nextConfig.outputFileTracingRoot = repoRoot;
  nextConfig.outputFileTracingIncludes = {
    "/": ["../../content/**/*", "../../pnpm-workspace.yaml", "../../config.toml"],
    "/articles/[slug]": ["../../content/**/*", "../../config.toml"],
    "/api/keystatic/[...params]": [
      "../../content/**/*",
      "../../pnpm-workspace.yaml",
    ],
  };
}

export default nextConfig;
