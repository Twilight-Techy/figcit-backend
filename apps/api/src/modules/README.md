# Modules

One folder per module (rules 2.1): `<module>.module.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.schemas.ts` (zod), `*.spec.ts`. Its Prisma models go in `apps/api/prisma/schema/<module>.prisma`.

Layers run one way: controller → service → repository → Prisma. A module calls another module's **exported service** only, and reacts to others through typed in-process events.

| Lane A (Twilight-Techy)                                                                                     | Lane B (OadeO6)                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| admin, ai, checkin, content, dump, express, feedback, recommendation, reflect, rules, safety, speech, tasks | adapt, analytics, audit, auth, billing, connect, consent, entitlements, files, health, institutions, jobs, notifications, practices, privacy, progress, regulate, shares, sync, users |

Ownership follows WORKFLOW §2; the issue's lane label wins if they ever disagree.
