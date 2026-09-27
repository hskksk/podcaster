import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { D2 } from "@terrastruct/d2";
import { printIssues, readD2Input, renderAscii, renderSvg } from "./lib/d2.ts";

function usage(): never {
  console.error("usage: d2-render <input.d2|-> <output.svg | output.txt | --ascii>");
  process.exit(1);
}

async function main(): Promise<void> {
  const [inputPath, outputArg, ...rest] = process.argv.slice(2);
  if (!outputArg || rest.length > 0) usage();
  const label = inputPath && inputPath !== "-" ? inputPath : "<stdin>";
  const src = (await readD2Input(inputPath)).trim();
  if (!src) {
    console.error("d2-render: empty input");
    process.exit(1);
  }

  const ascii = outputArg === "--ascii" || extname(outputArg) === ".txt";

  try {
    const response = await new D2().compile(src);
    if (outputArg === "--ascii") {
      process.stdout.write(`${(await renderAscii(response)).replace(/\s+$/, "")}\n`);
      process.exit(0);
    }

    const out = resolve(outputArg);
    mkdirSync(dirname(out), { recursive: true });
    const rendered = ascii ? await renderAscii(response) : await renderSvg(response);
    writeFileSync(out, rendered, "utf8");
    console.log(out);
    process.exit(0);
  } catch (err) {
    printIssues(err, src, label);
    process.exit(1);
  }
}

await main();
