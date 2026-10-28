#!/usr/bin/env bash
# Rebuilds a local dev environment from a fresh clone: Postgres, dependencies, schema, seed.
# Safe to run repeatedly. Used when a build container is replaced (docs/build/PROGRESS.md).
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v service >/dev/null && ! pg_isready -q -h localhost 2>/dev/null; then
  service postgresql start >/dev/null
fi
if [ "$(id -u)" = "0" ] && command -v su >/dev/null; then
  su postgres -c "psql -tAc \"select 1 from pg_roles where rolname='figcit'\"" | grep -q 1 \
    || su postgres -c "psql -c \"create role figcit login superuser password 'figcit'\""
  su postgres -c "psql -tAc \"select 1 from pg_database where datname='figcit'\"" | grep -q 1 \
    || su postgres -c "createdb -O figcit figcit"
  su postgres -c "psql -tAc \"select 1 from pg_database where datname='figcit_shadow'\"" | grep -q 1 \
    || su postgres -c "createdb -O figcit figcit_shadow"
fi
grep -q 'localhost:5432:\*:figcit' ~/.pgpass 2>/dev/null || { echo "localhost:5432:*:figcit:figcit" >> ~/.pgpass; chmod 600 ~/.pgpass; }
node scripts/dev-env.mjs

corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @figcit/api db:migrate
if [ "${SEED:-1}" = "1" ] && grep -q '"db:seed"' apps/api/package.json; then
  pnpm --filter @figcit/api db:seed || echo "seed failed (see output above)"
fi
echo "Backend ready. PWA: cd ../figcit-pwa && pnpm install --frozen-lockfile"
