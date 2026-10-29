# figcit-backend

Backend for **NUCCESS** by Figcit Ltd: a NestJS API and worker, PostgreSQL via Prisma, and `@figcit/engine`, the pure decision engine the PWA also bundles.

Start with [`AGENTS.md`](AGENTS.md), then [`docs/WORKFLOW.md`](docs/WORKFLOW.md), [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md) and [`docs/ENGINEERING_RULES.md`](docs/ENGINEERING_RULES.md).

## Layout

```
apps/api/                 NestJS app: src/main.ts (HTTP API), src/worker.ts (jobs)
  src/modules/<module>/   one folder per module (see src/modules/README.md)
  src/common/             config, crypto, db, errors, guards, openapi (no module logic)
  src/platform/           metrics and other cross-cutting infrastructure
  prisma/schema/          multi-file Prisma schema, one file per module
  prisma/migrations/
  test/                   e2e tests (*.e2e.ts, real Postgres)
packages/engine/          @figcit/engine: pure, zero dependencies
packages/rules-compiler/  workbook .xlsx → snapshot JSON + engine fixtures
openapi/                  generated openapi.json (never hand-edit); Swagger UI at /docs
docker/                   local stack (compose.dev.yml) and the API image
docs/                     specs, design, rules, workflow, conflicts, ADRs
scripts/                  repo checks used by CI
```

## Run it locally

Requires Node 22.12+, pnpm 10 (`corepack enable`), Docker (or a local Postgres 16) and `psql`.

```sh
pnpm install
docker compose -f docker/compose.dev.yml up -d   # Postgres 16, Mailpit (:8025), SeaweedFS S3 (:8333)
node scripts/dev-env.mjs                          # .env from .env.example, with local-only keys
pnpm db:generate && pnpm --filter @figcit/api db:migrate && pnpm --filter @figcit/api db:seed
pnpm dev                                          # API on PORT, or the first free port from 4000
pnpm check                                        # what CI's "check" job runs
```

**In a git worktree** (one issue per worktree, docs/WORKFLOW.md §5), run `pnpm db:worktree` once: it creates `figcit_<branch>` in the same Postgres, points this worktree's `.env` at it with its own free port, then migrates and seeds it. Worktrees never share a database.

**The image** (`docker/api.Dockerfile`) runs the API or the worker, non-root, with a read-only filesystem:

```sh
docker build -f docker/api.Dockerfile -t figcit-api .
docker run --read-only --tmpfs /tmp --env-file .env -p 3001:3001 figcit-api          # API
docker run --read-only --tmpfs /tmp --env-file .env figcit-api worker                 # worker
```

Migrations run at deploy time with `pnpm --filter @figcit/api db:migrate`, not from the image.

**CI** (`.github/workflows/ci.yml`) has stable job names to require in branch protection: `check` (lint, format, types, unit tests, engine coverage, knip, dependency-cruiser, licences, OpenAPI up to date, build), `e2e` (API against Postgres 16 with coverage), `audit` (`pnpm audit`, high and critical fail), `secrets` (gitleaks) and `image` (build, compressed size under 180 MB, Trivy).
