import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(appDir, "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@keystatic/core", "@keystatic/next"],
  // Monorepo: Keystatic local storage reads `content/` at the repo root.
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/": ["../../content/**/*", "../../pnpm-workspace.yaml"],
    "/api/keystatic/[...params]": [
      "../../content/**/*",
      "../../pnpm-workspace.yaml",
    ],
  },
};

if (process.env.KEYSTATIC_STANDALONE === "1") {
  nextConfig.output = "standalone";
}

export default nextConfig;
