import { createMarkdocConfig } from "@hskksk/markdoc-react/server";
import { markdocExtensions } from "../lib/markdoc/extensions";

/** Loaded by `@markdoc/next.js` (`schemaPath: ./markdoc`). */
export default createMarkdocConfig(markdocExtensions);
