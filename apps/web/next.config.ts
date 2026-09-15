import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const require = createRequire(import.meta.url);
const withMarkdoc = require("@markdoc/next.js") as (options?: {
  mode?: "static" | "server";
  schemaPath?: string;
}) => (config: NextConfig) => NextConfig;

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootCandidate = path.join(appDir, "../..");
const repoRoot = fs.existsSync(path.join(repoRootCandidate, "pnpm-workspace.yaml"))
  ? repoRootCandidate
  : appDir;

const nextConfig: NextConfig = {
  transpilePackages: ["@keystatic/core", "@keystatic/next"],
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdoc"],
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

// Standalone (Docker / Railway) needs the monorepo root in the file trace
// for Keystatic local storage. Public pages are SSG and do not read disk
// at request time. Do not set outputFileTracingRoot on Vercel.
if (process.env.KEYSTATIC_STANDALONE === "1") {
  nextConfig.output = "standalone";
  nextConfig.outputFileTracingRoot = repoRoot;
  nextConfig.outputFileTracingIncludes = {
    "/api/keystatic/[...params]": [
      "../../content/**/*",
      "../../pnpm-workspace.yaml",
    ],
  };
}

export default withMarkdoc({
  mode: "static",
  schemaPath: "./markdoc",
})(nextConfig);
