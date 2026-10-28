# Build report

What was built for `BRIEF.md`, how it was checked, and what is still open. Branch `claude/intelligent-ride-vnjnew` in both repos.

## What works
**Backend (`figcit-backend`).** Every module in SYSTEM_DESIGN: auth (magic link, password, Google stub, Browse token, staff TOTP), check-in and the rules engine (workbook v3.3, 189 scenarios), recommendation actions (try another, not now, adapt, why), safety and Help routes, sessions and feedback with re-check and Blue recovery, tasks with ordering and break-down, dump, express (with SSE streaming), adapt, connect, reflect and patterns, practices, reminders, inbox and push, progress and shares, plans and the fake billing provider, privacy export and delete, analytics, offline sync and Browse upgrade, institutions with the anonymity floor, and the admin console API (snapshots, review, safety sign-off, publish, content, decisions, staff, audit). AI tasks run through rule fallbacks here (X-04).

**PWA (`figcit-pwa`).** 99 routes covering all 136 entries in `design/SCREENS.md` (some screens are sheets or states of another route). Every screen has Back or Close and the Help pill; top-level screens have the bottom bar (Home, Tasks, Progress, Me), and Me links to everything that's yours. Browse mode runs the engine on the device (B-29); the service worker makes the app work offline (B-36).

## How it was checked
- Backend `pnpm check`: lint, format, types, 267 engine tests, unit tests, engine purity. `pnpm test:e2e`: 68 API tests against a seeded Postgres (`figcit_test`).
- PWA `pnpm check`: lint, format, types, unit tests, static build.
- Playwright journeys (scripts kept out of the repos) through: onboarding → Browse → full check-in → card; every Regulate tool → feedback → saved / didn't help; Meditate and own practices; dump capture → sort → item → task → break down → focus → pause → step done; tasks sort, pick, plan; Express simplify, structure, script and cards; Connect compose and contacts; Reflect, wins, history, patterns, review, month; Adapt; support plan, progress, did it help, share and the public shared view, reminders, inbox, every settings screen, log out, plans, choose, manage; institution lead dashboard, export and support requests; admin sign-in with TOTP and every admin screen; offline (Help, tools, check-in, dump, home with the network off); Browse → create account → data carried over.
- Axe on 85 routes: no serious or critical issues left (one transient result on the auto-redirecting send step).
- Bundle sizes: see B-37.

## Trying it yourself
1. Seed a database: `cd apps/api && DATABASE_URL=… pnpm db:seed` (see `SEED.md`). Every demo account's password is `Nuccess-demo-2026!`; staff accounts use the authenticator secret printed by the seed; the institution invite code is `NORTH2026`.
2. Run the API (`pnpm dev`) and the PWA (`NEXT_PUBLIC_API_URL=… pnpm build` then serve `out/`, or `pnpm dev`).
3. Good starting personas: `ada@nuccess.test` (Plus, lots of history), `ben@nuccess.test` (free, harder days), `lead@nuccess.test` (institution support lead), `admin@nuccess.test` (staff).

## Decisions and open items
Decisions taken under the brief: `DECISIONS.md` (B-01 to B-37). Things that need someone else: `BLOCKERS.md` (X-01 prices, X-02 clinical sign-off, X-03 social spaces, X-04 model server, X-05 research pipeline, X-06 push keys, X-07 speech server).

## Worth doing next
- Wire `size-limit` and shave the last few KB off Home and the routes (B-37).
- Lighthouse runs on a real mid-range phone.
- Check the copy end to end with Clinical Safety (X-02) and run the real model's week-1 test (X-04).
- Move the Playwright journeys into `figcit-pwa/e2e` once `@playwright/test` is justified as a dev dependency.
