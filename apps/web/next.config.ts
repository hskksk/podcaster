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
  transpilePackages: ["@keystatic/core"],
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdoc"],
  // Next 16 builds with Turbopack. @markdoc/next.js 0.7 attaches loader rules
  // only when `turbopack` is already set. The Node build of D2 pulls in a wasm
  // worker Turbopack cannot evaluate during client SSR; diagrams use the
  // browser build, which embeds that wasm module.
  turbopack: {
    root: path.resolve(repoRoot),
    resolveAlias: {
      "@terrastruct/d2": "./node_modules/@terrastruct/d2/dist/browser/index.js",
    },
  },
  // Applies only to `next dev --webpack` / `next build --webpack`.
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
  async redirects() {
    return [
      {
        source: "/articles/:slug.html",
        destination: "/podcast/articles/:slug",
        permanent: true,
      },
      {
        source: "/articles/:slug",
        destination: "/podcast/articles/:slug",
        permanent: true,
      },
      {
        source: "/search",
        destination: "/podcast/search",
        permanent: true,
      },
      {
        source: "/web-clips",
        destination: "/podcast/web-clips",
        permanent: true,
      },
      {
        source: "/web-clips/:slug",
        destination: "/podcast/web-clips/:slug",
        permanent: true,
      },
    ];
  },
};

// Standalone (Docker / Railway) needs the monorepo root in the file trace.
// Public pages are SSG and do not read disk at request time.
// Do not set outputFileTracingRoot on Vercel.
if (process.env.NEXT_STANDALONE === "1") {
  nextConfig.output = "standalone";
  nextConfig.outputFileTracingRoot = repoRoot;
}

const wrapped = withMarkdoc({
  mode: "static",
  schemaPath: "./markdoc",
})(nextConfig);

export default wrapped;
