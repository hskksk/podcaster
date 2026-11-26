import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Next 16 writes prerendered HTML to `.next/server/app` unless a build adapter
// is set. Vercel sets one, so the same files land under
// `.next/server/route-cache/<kind>/<sha256>/$/<page>.html`. Pagefind turns the
// path under `--site` into the result URL, so the cache prefix has to be
// stripped before indexing.

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appHtmlRoot = path.join(webRoot, ".next", "server", "app");
const routeCacheRoot = path.join(webRoot, ".next", "server", "route-cache");
const outputPath = path.join(webRoot, "public", "pagefind");

const cacheHtml = /\/route-cache\/[^/]+\/[0-9a-f]{64}\/\$\/(.+\.html)$/;

function listHtml(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { recursive: true })) {
    const rel = String(entry);
    if (!rel.endsWith(".html")) continue;
    const abs = path.join(dir, rel);
    if (fs.statSync(abs).isFile()) files.push(abs);
  }
  return files;
}

function stage(files, relativePath, staging) {
  let copied = 0;
  for (const file of files) {
    const rel = relativePath(file);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) continue;
    const dest = path.join(staging, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(file, dest);
    copied += 1;
  }
  return copied;
}

const appHtml = listHtml(appHtmlRoot);
const cacheHtmlFiles = appHtml.length > 0 ? [] : listHtml(routeCacheRoot);
const sourceLabel = appHtml.length > 0 ? ".next/server/app" : ".next/server/route-cache";
const sources = appHtml.length > 0 ? appHtml : cacheHtmlFiles;

const staging = fs.mkdtempSync(path.join(os.tmpdir(), "pagefind-site-"));
let exitCode = 1;
try {
  const copied =
    appHtml.length > 0
      ? stage(sources, (file) => path.relative(appHtmlRoot, file), staging)
      : stage(sources, (file) => {
          const match = file.split(path.sep).join("/").match(cacheHtml);
          return match ? match[1] : null;
        }, staging);

  if (copied === 0) {
    console.error(
      `pagefind: no prerendered HTML under ${appHtmlRoot} or ${routeCacheRoot}`,
    );
  } else {
    console.log(`pagefind: indexing ${copied} HTML files from ${sourceLabel}`);
    fs.rmSync(outputPath, { recursive: true, force: true });
    const localBin = path.join(webRoot, "node_modules", ".bin", "pagefind");
    const result = spawnSync(
      fs.existsSync(localBin) ? localBin : "pagefind",
      ["--site", staging, "--output-path", outputPath, "--force-language", "ja"],
      { cwd: webRoot, stdio: "inherit" },
    );
    if (result.error) console.error(result.error);
    exitCode = result.status ?? 1;
  }
} finally {
  fs.rmSync(staging, { recursive: true, force: true });
}
process.exit(exitCode);
