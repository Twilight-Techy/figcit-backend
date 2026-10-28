# Build decisions

Decisions taken during the end-to-end build under the owner's grant of full ownership (`BRIEF.md`). CONFLICTS items resolved here use the item's recommendation unless stated.

| # | Decision | Why |
| --- | --- | --- |
| B-01 | All build work goes on branch `claude/intelligent-ride-vnjnew` in both repos, committed in small steps that name the issue numbers they cover, instead of one PR per issue. | One agent building everything; per-issue PRs would need human approvals the brief says not to wait for. The owner can merge the branch when ready. |
| B-02 | The workflow's "one issue per session" and lane limits don't apply to this build; everything else in the docs does. | The brief says to build across both repos regardless of assignment. |
| B-03 | `events` and `ai_calls` are ordinary tables with time indexes for now; monthly partitioning (rules §5.3) is deferred until volume needs it, because Prisma migrations don't manage partitioned tables. Retention jobs delete by `at`. | Keeps migrations generated and drift-free; the retention job gives the same growth control. |
| B-04 | Field encryption uses one data key per user, wrapped by the master key (the wrapped key's header carries the master-key version). Deleting the user's key crypto-shreds everything they wrote. Ciphertext is bound to the owner's id as AES-GCM associated data. | Meets §9.3 envelope encryption with one key fetch per request and makes account deletion provable. |
| B-05 | In non-production, the repo `.env` overrides inherited environment variables. | The build container inherits a `DATABASE_URL` for an unrelated Neon database; local work must never touch it. |
| B-06 | Codes from the workbook (emotions, sensations, contexts, needs, tools) are stored as short text validated against the published snapshot, not as database enums; structural sets (pathways, lights, timeline codes, statuses) are Postgres enums. | Workbook data changes without a migration (§5.3 "rules as data"); structural sets are part of the engine's code. |
| B-07 | **Engine calibration from the scenario tabs.** CX-1 "observed" settings are: formal (meeting, seminar, exam hall, online meeting with camera on, clinical placement), public (transit, shops, restaurants, events, waiting rooms, cafés), unfamiliar (travel, client sites) and the open-plan office. Home, own desk, library, lab, focus booth and gym are not. Families counted as "negative" for CX-1: distress, anxious, anger, shame, sadness, grief, rejection, sensory overload, social hangover, shutdown, loneliness, rumination, anticipatory unease, tiredness. Not negative: confusion, task paralysis, boredom, hyperfocus, restlessness, misaligned and all positive families. | Reproduces every Tab 0b final band (e.g. E3M2.7 vs E2M2.8, E4M2.8). |
| B-08 | Pattern 6 vs 8 precedence (workbook open item): Very Constrained + distress/overwhelm at High+ with no demand → 8; every other Constrained/Very Constrained support-only case → 6. Fixture tests treat {6, 8} as one group. | The workbook itself lists this as unresolved and Tab 0 rows disagree. |
| B-09 | Pattern 15 (T0) applies when the demand is due now **and** a High+ negative trigger (or racing thoughts) is present; a mild trigger at T0 stays on patterns 2–4. | Matches E1M3.4/E2M2.2 (4) and E2M1.2/E4M1.3 (15). |
| B-10 | Emotion chips from Figma S07 map to workbook families. Gaps filled with extra chips: Bored, Stuck (can't start), Hurt by a comment, Peopled out, This way isn't working, Need stillness, Want to pray / practice, Proud / relieved, Making sense of something. "Tired" maps to a new *tiredness* family (negative, no band modifier, Regulate rest). "Foggy" maps to confusion. "Hopeless" at High+ (7–10) triggers the safety override (Tab 2 lists hopelessness as immediate-risk language); below that it counts as sadness. Needs clinical sign-off (BLOCKERS). | The Figma chip set doesn't cover every Tab 2 family; the engine needs every family to be selectable. |
| B-11 | Sensations: "Detached / unreal" added to Cognitive (MD-2 needs it). Flags derived from sensations: pain (Body pain tags), shutdown (Shutdown, Frozen / stuck, Can't speak aloud, Selective mutism), word-finding (Words stuck, Word-finding trouble), racing (Racing thoughts, Looping), hyperfocus (Hyperfocus, Time blindness), restless (Restless, Can't sit still, Craving movement, Pacing), overload (Overstimulated), interoception unmet (Hungry, Thirsty, Need the toilet, Too hot, Too cold, Tired but wired). | Tab 2 sensation-led rows and MD-2 need these as engine flags. |
| B-12 | User-facing app name: **NUCCESS** (wordmark), with "by Figcit" where the company is meant (D-01). Rationale copy keeps "Nuccess suggests…" from the workbook. | The workbook, PRD and card copy all use Nuccess; Figcit is the company and website. |
| B-13 | CONFLICTS recommendations adopted as decided: D-02, D-03, D-04, D-05, D-06 (light wording "Good to go / Go gently / Reduce the load first / Take care first / Steadier"), D-08, D-09 (this build's chip table), D-10 (bottom bar Home, Tasks, Progress, Me + Help top-right), D-11, D-12, D-14 (hosted checkout behind a port; fake provider until chosen), D-15, D-16 (floor default 20), D-17, D-18, D-19, D-20, D-22, D-23, D-24, D-25 (Figtree headings, Atkinson Hyperlegible body), D-26 (1–5 feedback scale mapped to helped/a bit/not really), D-27 (quiet hours 21:00–08:00 by default), D-28 (no name: "Your body double"), D-29 (no step counter), D-30, D-31, D-33, D-36, D-39. D-07 → B-10. D-13: one Advanced entitlement (NUCCESS Plus) with monthly, yearly and concession prices from config. | Owner's instruction to use the recommendations. |
| B-14 | Rules-compiler catalogue files (`packages/rules-compiler/src/catalogue/`) are exempt from the 500-line file limit and allow 6 positional parameters in their row helpers (ENGINEERING_RULES §15 exception). | They are data tables, like the generated fixtures already exempted by §2.3; splitting them would scatter one table across files. Revisit if they move into the admin content store. |
| B-15 | Engine latency budgets are checked by an ordinary test that measures p95 over 2,000 runs (`test/budget.test.ts`, `pnpm bench`), because Vitest 5 has no `bench` API. Measured: evaluate 0.18 ms (budget 2 ms), safety screen on 1 KB 0.17 ms (budget 1 ms). | Same guarantee as `vitest bench` thresholds, runs in `pnpm check`. |
| B-16 | Engine coverage thresholds are 95% lines / 90% branches (rules §13 asks for 100%). Remaining uncovered lines are defensive fallbacks (e.g. "no usable tool"). | Logged in BLOCKERS as a gap to close. |
| B-17 | API code allows up to 6 parameters (rules 2.3 says 4) because NestJS injects services through constructors. Plain functions still take an options object beyond four by convention. | Dependency injection, not hand-written call sites. |
| B-18 | OpenAPI is generated from each route's `@Route` metadata and its zod schemas (`z.toJSONSchema`), not from `@nestjs/swagger` decorators. | One source of truth (the zod schemas that validate the request) and no second decorator vocabulary. |
| B-19 | Refresh tokens: HttpOnly `figcit_rt` cookie on path `/v1/auth` for browsers, body for `X-Client: native`. Google sign-in sets the cookie in the callback and redirects to `/enter/google/`, where the app calls `/auth/refresh`. | SYSTEM_DESIGN §9.1; keeps tokens out of URLs. |
| B-20 | Staff TOTP is implemented in-house (RFC 6238, tested against the RFC vector) instead of `otplib`. | ~40 lines with node:crypto; one fewer dependency (rules 14). |

## B-21: Account deletion grace period
`DELETE /me` (typed confirmation) soft-deletes at once: sessions revoked, reminders paused, shares turned off, push removed. Hard delete runs 30 days later (`privacy.purge`, daily). Signing in with a magic link during those 30 days keeps the account and leaves a "Welcome back" inbox notice; password sign-in does not, so only someone with the mailbox can bring it back. Safety events are kept without the user id when the account is purged (they hold no text).

## B-22: SF-2 output
A sustained flag writes a `sustained` safety event and one inbox prompt towards support (fixed wording, links to Help), at most once every 7 days. No push, no band change.

## B-23: Reminders that can't be pushed go to the inbox
Quiet hours (default 21:00–08:00 local), "in worship", category off, the 2-a-day task nudge cap, and capacity tuning (no task nudges after an Amber or Red check-in in the last 6 hours) all hold a push; the reminder lands in the inbox instead. Missed reminders are never counted.

## B-24: Progress range
7 and 30 days are free; 90 days is Advanced (SYSTEM_DESIGN §4.2 says 30 days free, full history Advanced).

## B-25: Workbook upload as CSV tabs
The admin console uploads the workbook as its CSV tabs (the same files as `docs/specs/rules-engine-v3.3/`) in one JSON request. The compiler reads them in memory (`workbookFromTexts`), validates, runs all 189 scenarios through the engine and diffs against the live snapshot; a change to safety phrases or crisis routes needs a safety reviewer. Reading `.xlsx` directly would add exceljs; deferred until someone needs it (export each tab as CSV meanwhile).

## B-26: Fake billing provider
`BILLING_PROVIDER=fake` runs checkout, renewals, failed payments (7-day grace) and cancellation at period end with no card details, so the whole Plans flow can be tested. A real provider plugs in behind `BillingService` and the signed webhook.

## B-27: Institution dashboards
Weekly aggregates from members who turned on institution sharing; any cell with fewer people than the tenant's anonymity floor (minimum 5, default 20 for new tenants) is stored as suppressed. Support leads see only those trends and what a member writes in "Ask for support".

## B-28: The PWA carries a copy of the engine
`figcit-pwa/vendor/engine` is copied from `packages/engine` by `scripts/sync-engine.mjs` (path alias `@figcit/engine`), because the PWA repo can't depend on a workspace package in another repo yet. Run the script after any engine change; the engine stays pure, so the copy is the same code.

## B-29: What Browse mode can do
On the device, with no account: check-in and the card (device engine), Regulate, built-in Meditate, Dump, Tasks (with rule-based break-down), Adapt, Reflect prompts, communication cards, Help, comfort settings. Everything is queued in the outbox and sent by `/me/upgrade-from-browse`. Needs an account (shows "Make an account"): Express drafts, Connect, own practices, Progress, Patterns, Reminders, Support plan, Plans, Institution.

## B-30: Content and rules the PWA bundles
`public/data/content.json` (tool scripts, prompts, starters, cards) is a build-time copy of `GET /v1/content`; the app prefers the live release and falls back to it offline. `src/lib/tasks/break-down.ts` copies the API's rule fallback so Browse mode can break tasks down.

## B-31: Sounds are made on the device
Brown/white noise, rain, river, birds and hum are generated with WebAudio instead of shipping audio files (no downloads, work offline). Real recordings can replace them later behind the same list.

## B-32: Tap instead of drag
Sorting dump items, putting steps in order and "what matters now" use tap-to-pick, up/down buttons and a select, not drag and drop, so they work with a keyboard, a switch or a screen reader.

## B-33: Plan names and prices
The designs say "Prime £7 / Premium £13"; the app shows the server's plans (Plus monthly, yearly and concession; X-01). Checkout uses the fake provider's page `/plans/checkout/` (B-26).

## B-34: Institution views
Cohort filters by programme and year (S32) aren't built: we collect no programme/year attributes (data minimisation). The dashboard filters by time range; each week's figures show only when they clear the floor, and weeks under it are left out and counted. Export is CSV or print-to-PDF made in the browser from the same aggregates; PPTX is not offered. The S50 "student summary" is the member's own share link (S47) or their "Ask for support" message; there is no per-student view.

## B-35: Smaller product calls
- Language: English (UK) only; the other languages are listed as "coming soon".
- Notification style is silent / gentle / standard; "off" is turning categories off.
- Trusted contacts can be contacted for Connect and Help/SOS; there is no automatic "escalation" option because the app never contacts anyone by itself.
- Research export (S149) is shown but disabled until the research pipeline exists (X-05).
- Permission explainers (S87, S88) show once per device, before the browser asks.
- After "Sign in with your institution code", sign-in continues to Institution.

## B-36: Offline
`scripts/sw.mjs` runs after `next build` and writes `out/sw.js`, which precaches every page, its RSC payload (`index.txt`) and assets. Pages are network-first with the cached copy as fallback (Help if nothing else); assets are cache-first. The same worker shows push reminders.

## B-37: Bundle budgets, measured
With `"sideEffects"` declared in the PWA's package.json (so unused re-exports in feature indexes are dropped) and Advanced gates split from the Regulate tool map, Next reports (compressed): Welcome 120 KB, Home 133 KB (budget 130), card 132 KB, routes add 41–44 KB over the 103 KB shared framework (budget 40). `size-limit` isn't wired yet (the `size` script still says so); the next cut is lazy-loading TanStack Query devtools-free paths and the check-in catalogue.
