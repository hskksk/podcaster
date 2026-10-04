import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const hasDist =
  existsSync(new URL("../dist/server.js", import.meta.url)) &&
  existsSync(new URL("../dist/index.js", import.meta.url));

if (hasDist) {
  process.exit(0);
}

const result = spawnSync("pnpm", ["run", "build"], {
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
