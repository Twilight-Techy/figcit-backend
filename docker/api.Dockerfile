# One image for the API and the worker (the command picks which). Production dependencies only,
# non-root, and built to run with a read-only filesystem except /tmp:
#   docker run --read-only --tmpfs /tmp figcit-api            # API
#   docker run --read-only --tmpfs /tmp figcit-api worker     # pg-boss worker
# NODE_IMAGE lets CI or a mirror supply the same official image (e.g. mirror.gcr.io/library/node:22-slim).
ARG NODE_IMAGE=node:22-slim

FROM ${NODE_IMAGE} AS build
# OpenSSL here too, so Prisma generates the engine for the runtime's OpenSSL 3.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/engine/package.json packages/engine/
COPY packages/rules-compiler/package.json packages/rules-compiler/
# An optional build secret `ca` (an extra CA bundle) is for builds behind a TLS proxy; CI needs none.
RUN --mount=type=secret,id=ca NODE_EXTRA_CA_CERTS=/run/secrets/ca pnpm install --frozen-lockfile
COPY . .
RUN --mount=type=secret,id=ca NODE_EXTRA_CA_CERTS=/run/secrets/ca pnpm --filter @figcit/api db:generate \
  && pnpm --filter @figcit/engine build \
  && pnpm --filter @figcit/rules-compiler build \
  && pnpm --filter @figcit/api build \
  && pnpm deploy --legacy --filter @figcit/api --prod /out \
  # `pnpm deploy` reinstalls packages, so carry the generated Prisma client across.
  && cp -r "$(dirname "$(find node_modules/.pnpm -path '*node_modules/.prisma/client/index.js' | head -1)")/.." /out/node_modules/.prisma \
  && rm -rf /out/src /out/test /out/prisma/seed /out/*.config.ts /out/tsconfig*.json \
  # Not needed at runtime: the Prisma CLI and its tooling (peers of @prisma/client; migrations
  # run with `pnpm db:migrate` at deploy) and the WebAssembly engines for other databases.
  && cd /out/node_modules/.pnpm \
  && rm -rf prisma@* @prisma+engines* @prisma+config@* @prisma+fetch-engine@* @prisma+get-platform@* \
     typescript@* effect@* fast-check@* \
  && rm -f @prisma+client@*/node_modules/@prisma/client/runtime/*wasm* \
     @prisma+client@*/node_modules/@prisma/client/runtime/query_compiler* \
     @prisma+client@*/node_modules/@prisma/client/runtime/query_engine_bg* \
     /out/node_modules/.prisma/client/*.wasm

FROM ${NODE_IMAGE}
# Prisma's query engine needs OpenSSL; nothing else is installed.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
COPY --chmod=0755 docker/entrypoint.sh /usr/local/bin/figcit
USER node
EXPOSE 3001
ENTRYPOINT ["figcit"]
CMD ["api"]
