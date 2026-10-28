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
openapi/                  generated openapi.json (never hand-edit)
docker/                   local stack (compose.yaml) and the API image
docs/                     specs, design, rules, workflow, conflicts, ADRs
scripts/                  repo checks used by CI
```

## Getting started

Requires Node 22.12+ and pnpm 10 (`corepack enable`).

```sh
pnpm install
cp .env.example .env
docker compose -f docker/compose.yaml up -d   # Postgres, Mailpit, SeaweedFS
pnpm db:generate
pnpm dev                                       # API on PORT (default 3001): GET /v1/health
pnpm check                                     # lint, format, types, tests, engine purity
```
