# syntax=docker/dockerfile:1
# Build context must be the repository root.
# railway.json sets dockerfilePath to this file.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.14.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/gemini-batch-tts/package.json packages/gemini-batch-tts/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV KEYSTATIC_STANDALONE=1
ARG NEXT_PUBLIC_KEYSTATIC_STORAGE=local
ENV NEXT_PUBLIC_KEYSTATIC_STORAGE=$NEXT_PUBLIC_KEYSTATIC_STORAGE
RUN pnpm --filter @podcaster/web build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/content ./content
COPY --from=build --chown=nextjs:nodejs /app/config.toml ./config.toml
COPY --from=build --chown=nextjs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
