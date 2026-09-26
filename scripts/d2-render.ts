import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { D2 } from "@terrastruct/d2";

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    console.error("usage: d2-render <input.d2> <output.svg>");
    process.exit(1);
  }

  const src = readFileSync(inputPath, "utf8").trim();
  if (!src) {
    console.error("d2-render: empty input");
    process.exit(1);
  }

  const out = resolve(outputPath);
  mkdirSync(dirname(out), { recursive: true });

  const d2 = new D2();
  try {
    const result = await d2.compile(src);
    const svg = await d2.render(result.diagram, {
      ...result.renderOptions,
      noXMLTag: true,
    });
    writeFileSync(out, svg, "utf8");
    console.log(out);
    process.exit(0);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

await main();
