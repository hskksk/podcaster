import { makeRouteHandler } from "@keystatic/next/route-handler";
import config from "../../../../keystatic.config";
import { getRepoRoot } from "../../../../lib/repo-root";

export const { POST, GET } = makeRouteHandler({
  config,
  localBaseDirectory: getRepoRoot(),
});
