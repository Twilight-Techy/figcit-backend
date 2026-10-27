# Build progress

The end-to-end build described in `BRIEF.md`. Work happens on branch `claude/intelligent-ride-vnjnew` in both repos, committed and pushed after every step. Tick items as they land; on a wake-up, continue from the first unticked item.

Local environment: Postgres 16 runs in the container (`service postgresql start`; role/db `figcit`/`figcit`). Docker is installed but may be unusable; ffmpeg is installed.

**After a container restart (files kept):** `service postgresql start`, then `/tmp/claude-0/start-api.sh` if needed (recreate the helpers from the notes in `DECISIONS.md` if `/tmp` was wiped).

**After a container reset:** clone both repos into `/home/user`, check out `claude/intelligent-ride-vnjnew`, run `scripts/dev-bootstrap.sh` in the backend, then `pnpm install` in the PWA. The inherited `DATABASE_URL` points at an unrelated Neon database; `.env` overrides it (DECISIONS B-05), never use it.

## Phase 1: Database
- [x] Prisma schema for every module, with relations, indexes and constraints (`apps/api/prisma/schema/*.prisma`)
- [x] Initial migration (plus raw SQL for partial indexes and append-only guards)
- [x] Field-level encryption design (per-user data key wrapped by a master key) in `common/crypto`
- [ ] Seed data (`pnpm db:seed`): personas covering every light, pathway, plan, role and edge case

## Phase 2: Engine
- [x] rules-compiler: workbook CSV → snapshot JSON (validated) + 189 scenario fixtures (`pnpm fixtures:generate`)
- [x] Engine stages 0–12, `evaluate`, `evaluateRecheck`, Aho–Corasick safety matcher
- [x] Fixture tests (Tabs 0, 0b, 9, 10), property tests, budget tests (263 tests; p95 0.18 ms)
- [ ] xlsx upload path (exceljs) for the admin snapshot flow — do with Admin

## Phase 3: API platform
- [x] Config, logging, problem-details errors, zod validation
- [ ] OpenAPI generation script
- [x] Crypto, audit, users, preferences, consent
- [x] Auth: magic link, password, refresh rotation, Google (stub-able), Browse token, staff MFA
- [x] Jobs (pg-boss), mail (nodemailer; dev mailbox), storage (local disk + S3 adapter)
- [ ] Worker entry with job handlers; files controller; idempotency interceptor
- [x] Rate limits, CORS, security headers, health

## Phase 4: API product modules
- [x] Rules
- [ ] Content
- [x] Check-in, Recommendation (+ actions, adapt, why), Safety (+ support plan, trusted contacts)
- [ ] SF-2 sustained-Red job
- [x] Sessions & feedback (recheck, Blue recovery); Regulate uses sessions
- [x] Tasks (+ ordering, break-down), AI gateway with fallbacks
- [ ] Dump, Express, Speech
- [ ] Adapt, Connect, Reflect + Patterns, Practices
- [ ] Notifications (push, reminders, inbox), Progress, Shares
- [ ] Entitlements/Plans, Billing (fake provider), Analytics, Sync
- [ ] Privacy (export, delete, retention), Admin, Institutions

## Phase 5: PWA foundation
- [ ] Tokens and six themes, comfort settings before first paint, design-system components
- [ ] i18n/messages, API client + auth wrapper, Dexie + outbox + sync, service worker
- [ ] Engine on device + snapshot cache, safety hook, Help/SOS, error/offline states

## Phase 6: PWA screens (all of design/SCREENS.md)
- [ ] Onboarding, consent, auth, Browse
- [ ] Home, navigation, check-in flow, need/demand, quick check-in
- [ ] Card, sheets, guards, feedback/recheck
- [ ] Regulate, Dump, Express, Tasks/Focus, Adapt, Connect, Reflect/Patterns, Meditate/Practices
- [ ] Progress, Share, Reminders, Notifications, Settings, Plans, Install, Export/Delete
- [ ] Admin console, Institution dashboard

## Phase 7: Verification
- [ ] API e2e against seeded Postgres (harness in `apps/api/test`, own `figcit_test` db; 27 tests so far)
- [ ] Playwright journeys across every screen; navigation audit (every screen reachable)
- [ ] Accessibility (axe), budgets, offline
- [ ] Final report: what works, decisions, blockers
