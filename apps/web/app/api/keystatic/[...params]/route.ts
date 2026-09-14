import { makeRouteHandler } from "@keystatic/next/route-handler";
import config from "../../../../keystatic.config";
import { getRepoRoot } from "../../../../lib/repo-root";
import { isGithubStorage } from "../../../../lib/storage";

export const runtime = "nodejs";

export const { POST, GET } = makeRouteHandler({
  config,
  ...(isGithubStorage() ? {} : { localBaseDirectory: getRepoRoot() }),
});
