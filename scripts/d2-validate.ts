import { D2 } from "@terrastruct/d2";
import { printIssues, readD2Input } from "./lib/d2.ts";

async function main(): Promise<void> {
  const path = process.argv[2];
  const label = path && path !== "-" ? path : "<stdin>";
  const src = (await readD2Input(path)).trim();
  if (!src) {
    console.error("d2-validate: empty input (pass a .d2 file path or stdin)");
    process.exit(1);
  }

  try {
    await new D2().compile(src);
    console.log("ok");
    process.exit(0);
  } catch (err) {
    printIssues(err, src, label);
    process.exit(1);
  }
}

await main();
