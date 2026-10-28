# Builds the API and worker image (one image, two commands). Hardening lands with backend issue #93.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/engine/package.json packages/engine/
COPY packages/rules-compiler/package.json packages/rules-compiler/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @figcit/api db:generate && pnpm --filter @figcit/engine build && pnpm --filter @figcit/api build
RUN pnpm deploy --legacy --filter @figcit/api --prod /out

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
