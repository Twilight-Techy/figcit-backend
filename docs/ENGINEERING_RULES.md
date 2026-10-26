# NUCCESS backend: engineering rules

The rules every change to `figcit-backend` must follow. They're written to be checked: each one has a number to hit or a tool that enforces it (section 16). A pull request that breaks a rule doesn't merge, unless it records a written exception (section 15).

Read with `docs/SYSTEM_DESIGN.md`.

---

## 0. Priority order

When two rules pull against each other, the higher one wins:

1. **Safety**: Help/SOS and the safety check always work, fail towards showing help, and never wait on AI, payment or the network.
2. **Privacy and security**: health data is protected even if it costs speed.
3. **Correctness**: the engine gives the result the workbook says, every time.
4. **Performance and efficiency**: the budgets in this document.
5. **Developer convenience.**

**Measure, then optimise.** Every budget below is checked by a test or a metric. Don't add complexity (caches, workers, denormalised tables) without a measurement that shows a budget is at risk, and record the before/after numbers in the pull request.

---

## 1. Performance budgets

These are hard limits. CI checks the ones marked **CI**; production alerts watch the ones marked **Alert**.

### 1.1 Latency (server time, excluding network)

| Operation | p50 | p95 | p99 | Checked by |
| --- | --- | --- | --- | --- |
| `evaluate()` in `@figcit/engine` (one check-in) | < 0.5 ms | < 2 ms | < 5 ms | CI benchmark |
| Safety phrase check, 2,000 characters | < 0.2 ms | < 1 ms | < 2 ms | CI benchmark |
| `POST /check-ins` | < 30 ms | < 80 ms | < 150 ms | CI load test, Alert |
| `POST /check-ins/{id}/recommendation` | < 40 ms | < 100 ms | < 200 ms | CI load test, Alert |
| Any other read (`GET`) | < 20 ms | < 60 ms | < 120 ms | Alert |
| Any other write | < 30 ms | < 100 ms | < 200 ms | Alert |
| `POST /sync/push`, batch of 100 operations | < 150 ms | < 400 ms | < 800 ms | CI load test |
| `GET /rules/snapshot` (cache hit, `304`) | < 2 ms | < 5 ms | < 10 ms | CI load test |
| API cold start to ready | — | < 3 s | — | CI |
| Event-loop delay | — | < 20 ms | < 50 ms | Alert |

AI and speech calls have their own timeouts (design 4.3) and never count towards these numbers, because they're never on the path of a check-in or recommendation.

### 1.2 Memory and CPU

| Process | Idle RSS | Under load (200 req/s) | Notes |
| --- | --- | --- | --- |
| API | < 150 MB | < 384 MB | Node `--max-old-space-size=384`; alert at 80% |
| Worker | < 120 MB | < 256 MB | Exports and PDF builds stream; never hold a whole export in memory |
| Rule snapshot in memory | < 2 MB per version | — | At most 3 versions held (live, previous, draft under review) |

- One API instance (1 vCPU) must sustain **200 requests/second** of the mixed check-in workload within the 1.1 budgets (CI load test).
- No request may use more than **50 ms of CPU** on the main thread. Anything heavier (PDF export, workbook compile) runs in the worker or a `worker_threads` pool.

### 1.3 Storage

| Item | Budget |
| --- | --- |
| Docker image | < 180 MB (multi-stage build, `node:22-slim` or distroless, production deps only) |
| One check-in with emotions, sensations, context | < 1.5 KB on disk |
| One recommendation including trace | < 4 KB on disk (codes, not sentences, in the trace) |
| One active user's data per year (typical use) | < 2 MB |
| Database growth at 1,000 daily users | < 3 GB a year, excluding backups |

---

## 2. Code organisation

### 2.1 Structure
- **One folder per module** under `apps/api/src/modules/<module>/`, containing `<module>.module.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.schemas.ts` (zod) and `*.spec.ts`.
- **Layers, one direction only:** controller → service → repository → Prisma. Controllers never touch Prisma. Repositories hold no business rules.
- **Module boundaries:** a module may call another module's **exported service** only; it never imports another module's repository, schemas or files, and never queries another module's tables. Checked by `dependency-cruiser` rules (CI).
- **Cross-module reactions** go through in-process events (`@nestjs/event-emitter`) with typed payloads, e.g. `checkin.created`, not direct calls back and forth.
- **Shared code** lives in `apps/api/src/common/` (guards, interceptors, crypto, errors) and must have no module-specific logic.

### 2.2 The engine package
- `packages/engine` has **zero runtime dependencies**. Its `package.json` `dependencies` field must be empty (CI).
- It is **pure**: no `node:*` imports, no `Date`, `Math.random`, `process`, `console`, timers, network or file access. Time and randomness, if ever needed, are passed in. Enforced with ESLint `no-restricted-globals` / `no-restricted-imports` scoped to the package (CI).
- It returns results; it never throws for expected situations (section 11.2).
- It must run unchanged in Node 22 and in current Safari, Chrome and Firefox, because the PWA bundles it (CI runs its tests in Node and in a browser runner).

### 2.3 Size limits
| Thing | Limit (warn / fail) |
| --- | --- |
| File | 300 / 500 lines |
| Function | 40 / 80 lines |
| Cyclomatic complexity per function | 10 / 15 |
| Function parameters | 4 (use an options object beyond that) |
| Nesting depth | 3 / 4 |

Enforced by ESLint (`max-lines`, `max-lines-per-function`, `complexity`, `max-params`, `max-depth`). Workbook-generated fixture files are exempt.

### 2.4 Naming
- Files `kebab-case.ts`; classes `PascalCase`; functions and variables `camelCase`; constants `UPPER_SNAKE_CASE`; database tables and columns `snake_case` (Prisma `@@map`/`@map`).
- Workbook codes keep the workbook's IDs exactly: `E3M2`, `T1`, `EX-1`, `RF-2`, `P05`. Never renamed or re-numbered.
- Booleans read as questions: `isRecheck`, `hasDemand`, `canShowUpsell`.

---

## 3. TypeScript discipline

- `strict: true`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `useUnknownInCatchVariables`.
- **Banned:** `any`, `as unknown as`, non-null assertions (`!`), `@ts-ignore`. `@ts-expect-error` only with a reason comment. TypeScript `enum` (use `as const` objects and union types). Default exports.
- **Exported functions have explicit return types.**
- **Data crossing a boundary** (HTTP body, database JSON, AI output, workbook file, environment) is parsed with zod before use. Inside the boundary, trust the types.
- **Exhaustive switches** over unions end with an `assertNever(x)` so a new code (a new timeline code, a new pathway) breaks the build until it's handled.
- `readonly` on arrays and objects that aren't meant to change, especially in the engine and snapshot types.
- Dates are `Date` in UTC on the server; time zones only at the edges (reminders use the user's IANA zone).

---

## 4. Time and space complexity

- **State what it costs.** Any function that loops over a collection that can grow with user data gets a one-line comment with its time and space cost, e.g. `// O(n log n) time, O(n) space, n = tasks (max 500)`.
- **Bound every collection.** Every list input has a maximum in its zod schema and every list query has a `take` limit. Defaults: page size 50, maximum 100; dump items per dump 200; tasks per user 500 active; steps per task 20; emotions per check-in 3; sync batch 200 operations.
- **No O(n²) over user data.** Nested loops over two user collections must be replaced with a `Map`/`Set` lookup. Allowed only for fixed, tiny sets (e.g. 8 pathways × 3 alternatives), with a comment saying so.
- **Engine lookups are O(1).** At snapshot load, the engine builds indexed structures once:
  - `cellByCoord`: a 4×4 array indexed by energy and mood;
  - `Map` objects for emotion → family, tag → flags and tool ID → tool;
  - pattern rules pre-sorted by priority.

  `evaluate()` then runs in O(p + t) time, where p is patterns (41) and t is candidate tools, with no allocation inside hot loops beyond the result.
- **Safety phrase check is linear.** Phrases compile once per snapshot into an Aho–Corasick automaton (a small in-house implementation inside the engine, so there are no dependencies). Matching is O(text length) and immune to regex backtracking. User input is never turned into a regular expression.
- **Sorting** uses the built-in sort (O(n log n)) with a stable, total comparator; ties break on ID so results never flip.
- **Strings:** no repeated concatenation in loops (collect then `join`); no `JSON.stringify` of large objects for comparison or logging.

---

## 5. Database (PostgreSQL + Prisma)

### 5.1 Queries
- **Every query uses an index.** A pull request adding or changing a query on a table that can exceed 10,000 rows includes its `EXPLAIN (ANALYZE, BUFFERS)` plan on seeded data. No sequential scans on such tables.
- **Select only needed columns** (`select`, never bare `findMany`). Never `SELECT *` in raw SQL.
- **No N+1.** Fetch related rows in one query (`include`/`select` with relations, or `IN (...)` by IDs), never in a loop. The test suite fails if a request runs more than 10 queries (query counter in e2e tests).
- **Every user-owned query is scoped by `user_id`** in the repository method signature (`findTask(userId, taskId)`), never by ID alone. This is also the object-level access check (section 10.2).
- **Pagination by cursor** (`WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT n`). `OFFSET` is banned.
- **Raw SQL** only through Prisma's tagged `$queryRaw\`...\`` (parameterised). `$queryRawUnsafe` and `$executeRawUnsafe` are banned (lint).
- **Counts:** no `COUNT(*)` on large tables in request paths; use the roll-up tables the worker maintains.

### 5.2 Transactions and connections
- Transactions are short: **no network calls (AI, email, storage) inside a transaction.** Write the row, commit, then call out (or emit an outbox job).
- Server settings: `statement_timeout = 5s` for the API role, `30s` for the worker role; `idle_in_transaction_session_timeout = 10s`; `lock_timeout = 3s`.
- Pool size per API instance: 10 (Neon pooled URL) and documented per environment. The worker uses the direct URL with its own small pool.

### 5.3 Schema
- **Smallest correct types:** `smallint` for 1–4 scales, 0–10 intensities and 1–5 ratings; `text` with a `CHECK` or a lookup table for codes; `timestamptz` for all times; `uuid` (v7) for IDs; `boolean` not text flags.
- **UUIDv7 keys** keep inserts index-friendly (time-ordered). No random v4 primary keys on high-insert tables.
- **Indexes are designed with the table**, listed in the Prisma schema and justified in the pull request. Default pattern for user timelines: `(user_id, created_at DESC)`. Partial indexes for hot subsets (e.g. `WHERE deleted_at IS NULL`, `WHERE status = 'active'`). No index without a query that uses it.
- **JSONB only for** the engine trace, the rule snapshot, card payloads and event properties; never for data that is filtered or joined on. Large JSONB columns use `lz4` compression (`ALTER TABLE … ALTER COLUMN … SET COMPRESSION lz4`).
- **Growth control:**
  - `events` and `ai_calls` are partitioned by month (native Postgres partitioning); a worker job drops partitions past retention (`events` 13 months, `ai_calls` 90 days, `sign_in_events` 12 months).
  - Soft-deleted rows are hard-deleted within 30 days.
- **Encrypted columns** (🔒 in the design) are `bytea`, with a key version in the same row.

### 5.4 Migrations
- Every migration is **backward compatible** with the previous release (expand → migrate data → contract over separate releases), so deploys never need downtime.
- No table-locking operations on large tables: indexes are created with `CREATE INDEX CONCURRENTLY` (hand-written SQL migration), new columns are nullable or have constant defaults, and column type changes go through a new column.
- Migrations run before the new release starts, in CI against a copy of the schema, and are never edited after merge.

---

## 6. Memory, CPU and I/O

- **Stream anything that can be large:** exports, CSV/PDF builds, file transfers (presigned URLs, so file bytes never pass through the API), and large query results (cursor batches of 500).
- **Request body limits:** 64 KB by default; 1 MB for `/sync/push`; uploads never go through the API. Larger bodies get `413`.
- **No synchronous I/O** after startup (`fs.*Sync`, `child_process.*Sync`, `crypto.*Sync` for heavy work are lint-banned outside startup code).
- **CPU-heavy work leaves the event loop:**
  - argon2 hashing uses the library's async native implementation;
  - workbook compile, PDF generation and export packing run in the worker process or a `worker_threads` pool (Piscina, MIT).
- **Password hashing:** argon2id with OWASP minimums (memory 19 MiB, 2 iterations, parallelism 1), tuned so one hash takes 50–150 ms on production hardware. Rate limits (section 10.4) keep this from becoming a denial-of-service lever.
- **Caching, in order of preference:**
  1. Don't do the work: HTTP `ETag` + `304` for the snapshot and other rarely changing reads.
  2. Per-process memory: compiled snapshots by version (bounded), tool catalogue.
  3. Per-request memoisation: user entitlements and consent loaded once per request.
  4. **No Redis** or other shared cache until a measurement shows Postgres can't keep up. Shared state (rate limits) lives in Postgres when there's more than one API instance.
- **No unbounded in-memory structures.** Every in-process cache has a maximum size and eviction (LRU).
- **Timers:** none in the API process except the shutdown drain; scheduled work belongs to pg-boss in the worker.

---

## 7. Scaling

- **Stateless API.** No user state in process memory between requests. Any instance can serve any request, so instances can be added behind the load balancer.
- **Idempotency everywhere:** creates carry client UUIDs, and the `Idempotency-Key` header is honoured for 24 hours. Every job is safe to run twice.
- **Backpressure:**
  - The AI and speech queues have a maximum depth; when full, calls get the fallback at once instead of waiting.
  - pg-boss concurrency per job type is configured, never unlimited.
- **Graceful shutdown:** on `SIGTERM`, stop accepting requests, finish in-flight ones (up to 10 s), close the database pool, then exit. The worker finishes or releases the current job.
- **Health:** `/health/live` (process up) and `/health/ready` (database reachable, snapshot loaded). The load balancer only routes to ready instances.
- **Growth path,** taken only when metrics demand it:
  - more API instances;
  - a separate worker per heavy job type;
  - a Postgres read replica for progress, admin and institution reads;
  - a GPU AI server;
  - splitting a module into its own service along the boundaries in section 2.1.

---

## 8. AI and speech

- **Never on the critical path.** No check-in, recommendation, safety or Help response may wait for AI. AI results arrive as optional improvements with a manual fallback.
- **Every call has:** a timeout (`AbortSignal.timeout`), a zod-validated structured output, the business checks from design 4.3, a fallback, and an `ai_calls` log row without text.
- **Circuit breaker:** after 5 consecutive failures or timeouts, the AI client stops calling for 30 s and serves fallbacks; then it tries one request again.
- **Fixed prompt first, user text last,** so the model server reuses its cached prompt prefix. Prompts are versioned content, never built by string concatenation of user data outside the `<user_words>` block.
- **Model files are pinned by SHA-256** in config; the AI server refuses a file whose hash differs.
- **Bounded output:** `max_tokens` per task as in the design; streaming responses stop at the limit.

---

## 9. Storage and data lifecycle

- **Store codes, not sentences:** traces record rule IDs, pattern numbers and tool IDs; the wording is rebuilt from the snapshot version when shown.
- **No duplicate copies of user data** across tables; derived numbers live only in roll-up tables the worker rebuilds.
- **Files:** audio for transcription deleted as soon as the transcript is saved (a lifecycle rule deletes any left after 24 h as a backstop); exports deleted after 48 h; user-kept voice notes and practice audio stored in Opus (≤ 48 kbps) at upload.
- **Retention is code, not policy:** every table with personal data has a retention rule implemented as a worker job, with a test.
- **Backups:** daily, with point-in-time recovery of at least 7 days; a restore is rehearsed before launch and then quarterly.

---

## 10. Security

Target: **OWASP ASVS 4.0 Level 2** for the whole API.

### 10.1 Authentication and sessions
- As in design 9.1:
  - access JWTs for 15 minutes;
  - refresh tokens stored hashed, rotated on every use, with reuse detection;
  - staff MFA required;
  - lockout after 5 failures.
- JWTs are verified with an algorithm allow-list (`EdDSA` only) and checked for `iss`, `aud` and `exp`. Keys are rotated with a `kid`.
- Secrets and tokens are compared with `crypto.timingSafeEqual`.

### 10.2 Authorisation
- **Default deny:** a global guard requires authentication on every route; public routes are marked `@Public()` explicitly and listed in a test that fails if the list changes without review.
- **Roles** are checked by a guard (`@Roles(...)`); **ownership** is enforced by scoping every repository query by `user_id` (section 5.1). Fetching a record by ID alone is banned in repositories.
- **Consent** is checked by `@RequiresConsent(purpose)` before processing wellbeing, analytics or research data.
- **The database enforces least privilege:**
  - the app role can't `UPDATE` or `DELETE` `audit_events`, or drop tables;
  - migrations run as a separate role.

### 10.3 Input and output
- Every request is validated by zod; unknown fields are rejected; strings have maximum lengths; numbers have ranges.
- Responses use explicit output schemas, so internal fields (hashes, encrypted blobs, internal IDs, traces for customers) can't leak by accident.
- **No user-supplied URL is ever fetched by the server** (no SSRF). Practice "links" are stored and opened by the user's own browser, never by us.
- Uploaded files are checked by content (magic bytes), size and type; their names are never used as storage paths.

### 10.4 Abuse protection
- Rate limits per IP and per user:
  - auth routes 10/min per IP and 5 failures per account;
  - AI routes as configured;
  - everything else 300/min per user.
- Magic-link and reset responses are identical whether or not the email exists.

### 10.5 Secrets and dependencies
- No secrets in the repository, images, logs or error reports. Local secrets in `.env` (git-ignored); deployed secrets via SOPS + age or the host's secret store. `gitleaks` scans every pull request.
- **Dependencies:**
  - pinned exact versions;
  - lockfile committed;
  - `pnpm install --frozen-lockfile`;
  - lifecycle scripts disabled except an allow-list;
  - `pnpm audit` (high or critical fails CI);
  - Renovate for updates;
  - licence allow-list (MIT, Apache-2.0, BSD, ISC, MPL-2.0, 0BSD, MIT-0) checked in CI.
- **Container:** runs as a non-root user with a read-only filesystem except `/tmp`, no extra Linux capabilities; Trivy scans the image (high or critical fails CI).

### 10.6 Privacy in code
- No personal data in URLs or query strings (IDs only).
- Logs and error reports never include request bodies, free text, emails, tokens or health data. A `pino` redaction list covers known fields, and a test feeds sample sensitive data through the logger and asserts it isn't written.
- Analytics events accept only enumerated codes (zod schema per event).

### 10.7 Reviews
- Any change to auth, encryption, safety, consent or sharing needs a second reviewer and a short threat-model note in the pull request (what could go wrong, what stops it).
- OWASP ZAP baseline scan against staging before each release.

---

## 11. Error handling

### 11.1 Rules
- **Fail towards safety.** If anything in the safety path fails (phrase check error, snapshot missing), the response is to show Help, never to continue as if safe.
- **Fail towards support.** If the engine can't produce a normal card (bad input, missing data), it returns the safety-floor card for the state (free Regulate, Dump, Help) rather than an error.
- **Every outbound call has a timeout** (database via `statement_timeout`; HTTP via `AbortSignal.timeout`; SMTP 10 s). There is no call without one.
- **Retries** only for idempotent outbound operations: exponential backoff with full jitter, maximum 3 attempts, and never for interactive AI calls.
- **Jobs:** each pg-boss job type has a retry limit and backoff; after the last attempt it goes to a dead-letter queue that alerts.
- **Unexpected errors crash the process cleanly.** On `uncaughtException`/`unhandledRejection`, the process logs and exits so the supervisor restarts it, instead of carrying on in an unknown state.

### 11.2 Error types
- The engine and pure helpers **return results** (`{ ok: true, value } | { ok: false, error }`) for expected outcomes; they don't throw.
- Services throw only `DomainError` subclasses with a stable `code` (`TASK_NOT_FOUND`, `CONSENT_REQUIRED`, `RATE_LIMITED`, …). One global exception filter maps them to RFC 9457 problem responses with plain, non-blaming titles.
- Anything else becomes a `500` with a generic message and a correlation ID; the details go to logs and GlitchTip, never to the client.
- **Never** throw strings, swallow errors silently (`catch {}` is lint-banned), or use errors for normal control flow.

---

## 12. Observability

- **Logs:** structured JSON (`pino`), one line per request with route template (not the raw path), status, duration, user hash and correlation ID. Levels: `error` (needs action), `warn` (degraded, e.g. AI fallback), `info` (lifecycle), `debug` (off in production).
- **Correlation ID:** from the `X-Request-Id` header (generated if missing), carried through events and jobs.
- **Metrics:** `prom-client` (Apache-2.0) on a private `/metrics` port, scraped by Prometheus with Grafana dashboards (both open source, self-hosted) once there are real users. RED metrics per route, event-loop delay, heap, database pool use, job queue depth, AI latency and fallback rate.
- **Alerts:**
  - any section 1 budget breached for 5 minutes;
  - error rate > 1%;
  - a dead-letter job;
  - a safety-path error (alerts immediately);
  - backup failure.

---

## 13. Testing

| Kind | Rule | Tool |
| --- | --- | --- |
| Engine fixtures | Every scenario row in workbook Tabs 0, 0b, 6d, 9 and 10 passes | Vitest |
| Engine properties | For random valid inputs: exactly one primary; Red never has a task primary; safety triggers always return Help; no Advanced tool in Amber/Red; result identical on re-run | `fast-check` (MIT) |
| Engine coverage | 100% lines and branches | Vitest coverage |
| Module coverage | ≥ 85% lines, ≥ 80% branches | Vitest coverage |
| API e2e | Real Postgres; every route's happy path, auth failure, ownership failure (another user's ID) and validation failure | Vitest + Supertest + Testcontainers |
| Performance | Engine and safety micro-benchmarks; HTTP load test of the check-in mix against the 1.1 budgets | `vitest bench`, `autocannon` (MIT) |
| Security | Secrets scan, dependency audit, image scan, ZAP baseline | gitleaks, `pnpm audit`, Trivy, OWASP ZAP |
| Logging | Sensitive sample data never appears in logs | Vitest |

- Tests are deterministic: no real clock (inject time), no real network, no order dependence.
- A bug fix comes with a test that fails without the fix.

---

## 14. Pull requests and discipline

- **Small and single-purpose:** aim for under 400 changed lines (generated files excluded). One concern per pull request.
- **Conventional commit messages** (`feat(engine): …`, `fix(auth): …`).
- **Definition of done:** all CI checks green, budgets met, docs updated if behaviour or design changed, migration reviewed, rule IDs referenced for engine changes.
- **Decisions are written down:** anything that changes the design or bends a rule gets a short ADR in `docs/adr/NNNN-title.md` (context, decision, consequences).
- **No `TODO` without an issue link**; no commented-out code; no dead code (lint `no-unused-*`, `ts-prune`/`knip` in CI).
- **Formatting is not discussed:** Prettier decides.
- **Dependencies are a cost:** every new runtime dependency is justified in the pull request (what it does, size, licence, maintenance, why Node built-ins aren't enough). Prefer Node built-ins (`fetch`, `crypto`, `node:test` utilities, `structuredClone`).

---

## 15. Exceptions

A rule can be broken only with an `ADR` or a pull-request note that names the rule, explains why, states the cost, and says when it will be revisited. Safety and privacy rules (sections 0.1, 0.2, 10, 11.1 first two bullets) have no exceptions.

---

## 16. Enforcement

| Rule area | Enforced by | Where |
| --- | --- | --- |
| Formatting | Prettier | pre-commit + CI |
| TypeScript strictness, banned constructs, size limits, complexity | ESLint (`@typescript-eslint` strict, `eslint-plugin-security`, custom restricted syntax) | CI |
| Module boundaries, engine purity | `dependency-cruiser`, ESLint restricted imports/globals | CI |
| Engine has no dependencies | script checks `packages/engine/package.json` | CI |
| Dead code and unused deps | `knip` | CI |
| Tests, coverage, fixtures | Vitest with coverage thresholds | CI |
| Performance budgets | `vitest bench` thresholds, `autocannon` load test against a CI Postgres | CI (nightly for load test, every PR for benchmarks) |
| Query count per request | e2e query counter | CI |
| Migration safety | Prisma migrate diff + a check that new indexes use `CONCURRENTLY` | CI |
| Secrets | gitleaks | pre-commit + CI |
| Vulnerabilities | `pnpm audit`, Trivy | CI |
| Licences | licence checker with the allow-list | CI |
| Image size | CI step fails above 180 MB | CI |
| Runtime budgets | Prometheus alerts | Production |
