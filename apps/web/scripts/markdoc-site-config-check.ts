/**
 * Ensures Markdoc transform output stays stable for a fixture document.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Markdoc from "@markdoc/markdoc";
import { createMarkdocConfig } from "@hskksk/markdoc-react/server";
import { markdocExtensions } from "../lib/markdoc/extensions";

const { Tag } = Markdoc;

const here = path.dirname(fileURLToPath(import.meta.url));
const webPkg = JSON.parse(readFileSync(path.join(here, "../package.json"), "utf8")) as {
  dependencies: Record<string, string>;
};

const declared = webPkg.dependencies["@hskksk/markdoc-react"];
if (declared && !declared.includes("0.5") && !declared.startsWith("workspace:")) {
  console.warn(
    `markdoc-site-config-check: expected @hskksk/markdoc-react 0.5.x with /server entry (got ${declared})`,
  );
}

function serialize(node: unknown): unknown {
  if (node == null || typeof node === "string" || typeof node === "number") return node;
  if (Array.isArray(node)) return node.map(serialize);
  if (Tag.isTag(node)) {
    return {
      name: node.name,
      attributes: node.attributes,
      children: node.children.map(serialize),
    };
  }
  return node;
}

const fixture = `
## Section {#sec}

{% callout type="note" %}
Note body
{% /callout %}

\`\`\`ts
const x = 1;
\`\`\`

{% diagram type="mermaid" %}
graph TD
  A --> B
{% /diagram %}
`.trim();

const config = createMarkdocConfig(markdocExtensions);
const ast = Markdoc.parse(fixture);
const tree = Markdoc.transform(ast, config);
const hash = createHash("sha256").update(JSON.stringify(serialize(tree))).digest("hex");

const goldenPath = path.join(here, "fixtures/markdoc-site-config.sha256");
const golden = readFileSync(goldenPath, "utf8").trim();
if (hash !== golden) {
  console.error(
    "markdoc-site-config-check: transform golden hash mismatch.\n" +
      `  expected: ${golden}\n` +
      `  actual:   ${hash}\n` +
      "If you intentionally changed the schema, update apps/web/scripts/fixtures/markdoc-site-config.sha256",
  );
  process.exit(1);
}

console.log("markdoc-site-config-check: ok");
