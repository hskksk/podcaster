/**
 * Ensures server-side Markdoc schema stays aligned with @hskksk/markdoc-react version.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Markdoc from "@markdoc/markdoc";

const { Tag } = Markdoc;
import { markdocExtensions } from "../lib/markdoc/extensions";
import {
  MARKDOC_REACT_SYNC_VERSION,
  createSiteMarkdocConfig,
} from "../lib/markdoc/site-config";

const here = path.dirname(fileURLToPath(import.meta.url));
const webPkg = JSON.parse(readFileSync(path.join(here, "../package.json"), "utf8")) as {
  dependencies: Record<string, string>;
};

const installed = webPkg.dependencies["@hskksk/markdoc-react"]?.replace(/^\^/, "");
if (!installed) {
  console.error("markdoc-site-config-check: @hskksk/markdoc-react not in package.json");
  process.exit(1);
}
if (installed !== MARKDOC_REACT_SYNC_VERSION) {
  console.error(
    `markdoc-site-config-check: package.json has @hskksk/markdoc-react@${installed} ` +
      `but MARKDOC_REACT_SYNC_VERSION=${MARKDOC_REACT_SYNC_VERSION}. ` +
      "Update lib/markdoc/site-config.ts (and golden hash if needed).",
  );
  process.exit(1);
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

const config = createSiteMarkdocConfig(markdocExtensions);
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
      "If you intentionally changed site-config, update apps/web/scripts/fixtures/markdoc-site-config.sha256",
  );
  process.exit(1);
}

console.log(`markdoc-site-config-check: ok (@hskksk/markdoc-react@${MARKDOC_REACT_SYNC_VERSION})`);
