import {
  defineRailway,
  github,
  project,
  service,
} from "railway/iac";

export default defineRailway((ctx) => {
  const isProd = ctx.environment === "production";

  const web = service("web", {
    source: github("hskksk/podcaster", { rootDirectory: "apps/web" }),
    build: "pnpm --filter web build",
    start: "pnpm --filter web start",
    healthcheck: "/",
    healthcheckTimeout: 60,
    env: {
      NODE_ENV: isProd ? "production" : "development",
    },
  });

  return project("podcaster", {
    resources: [web],
  });
});
