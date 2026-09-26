import { readFileSync } from "node:fs";
import { D2 } from "@terrastruct/d2";

async function readInput(path: string | undefined): Promise<string> {
  if (path && path !== "-") {
    return readFileSync(path, "utf8");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const path = process.argv[2];
  const src = (await readInput(path)).trim();
  if (!src) {
    console.error("d2-validate: empty input (pass a .d2 file path or stdin)");
    process.exit(1);
  }

  const d2 = new D2();
  try {
    await d2.compile(src);
    console.log("ok");
    process.exit(0);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

await main();
