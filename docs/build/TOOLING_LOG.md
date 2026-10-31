# Tooling work log (after Twilight-Techy/figcit-backend#98 and Twilight-Techy/figcit-pwa#80)

Covers both repos, from the last merged PRs (#98 here, #80 in the PWA) to 2026-10-29 19:00 UTC.
The work is on branch `claude/intelligent-ride-vnjnew` in each repo. It is in two open PRs, and
neither is merged:

- Backend: [Twilight-Techy/figcit-backend#99](https://github.com/Twilight-Techy/figcit-backend/pull/99)
- PWA: [Twilight-Techy/figcit-pwa#81](https://github.com/Twilight-Techy/figcit-pwa/pull/81)

Both wait on review from OadeO6, because both include tier-A work.

## What this was

The tooling issues left open after the product work:

- Backend:
  - #2: CI gates.
  - #3: dev stack.
  - #6: OpenAPI generation, its staleness check and examples.
  - #52: engine publish.
- PWA:
  - #2: bundle budgets, Lighthouse and axe.
  - #12: MSW mocks.
  - #13: CSP and security headers.

Three follow-ups came out of that work. Each is also done; see the last part of each repo's list
below.

## Backend: done

Commits `9784f16`, `28383c0` and `d233cad`.

- **CI** (`.github/workflows/ci.yml`). The job names are stable, so they can be required in branch
  protection.
  - `check`: lint, format, types and unit tests, plus engine purity, knip, dependency-cruiser and
    the licence allow-list.
  - `check` also runs engine coverage, `openapi:check` and the build.
  - `e2e`: the API end to end against Postgres 16, with coverage thresholds.
  - `audit`: `pnpm audit --audit-level high`.
  - `secrets`: gitleaks over the whole history, using `.gitleaks.toml` and `.gitleaksignore`.
  - `image`: Docker build, a size gate (compressed, under 180 MB), and Trivy (high and critical
    fail).
  - `openapi`: an artifact on `main`.
- **Fixes from the first CI run:**
  - Trivy now runs from its official image, because the action tag didn't exist.
  - The runtime image drops npm and corepack. They carried every HIGH finding.
  - The CI Postgres uses trust auth, so there is no password literal.
  - `openapi:check` gets throwaway keys.
  - The audit job no longer uses a pnpm cache, since it doesn't install.
- **Image** (`docker/api.Dockerfile`):
  - Production dependencies only, a non-root user, and a read-only filesystem except `/tmp`.
  - One image runs `api` or `worker`.
  - The Prisma engine is now built for OpenSSL 3.
  - 104 MB compressed.
- **Dev stack:**
  - `docker/compose.dev.yml` (renamed) creates the dev bucket.
  - `pnpm db:worktree` gives each worktree its own database and port.
  - `pnpm dev` falls back to a free port.
  - The README has a new "Run it locally" section.
- **Engine release** (`.github/workflows/engine-release.yml`):
  - The tag `engine-vX.Y.Z` runs test, build, then publish to GitHub Packages as
    `@twilight-techy/engine`.
  - The PWA consumes it as `@figcit/engine` through an alias.
  - The engine is at version 1.1.0, with a test that keeps `ENGINE_VERSION` in step.
- **Security overrides:** fastify 5.12.7 and deepmerge-ts 8.
- **OpenAPI examples (#6):**
  - Every request body, query and response in `openapi/openapi.json` has an example.
  - The examples are built from the zod schemas (`src/common/openapi/example.ts`) and are made up:
    fixed ids and clock, example.test addresses, and `<example-…>` placeholders for credentials.
  - A route can set its own example with `example` in `@Route`.
  - Every example is parsed by its schema, and `openapi:generate` fails on a mismatch.
- **Decisions:** B-46 in `DECISIONS.md` covers the licence exceptions, the coverage ratchet, the
  image size measure and the package scope.

## PWA: done

Commits `3dcca7f`, `120ea41`, `bdf6846` and `fc1de49`. CI is green on all of them.

- **Bundle budgets:** `scripts/size.mjs`, part of `pnpm check`.
  - Measured with brotli: first screen ≤ 130 KB, each route ≤ 40 KB added, engine ≤ 25 KB.
  - It fails if any mock code reaches the production bundle.
- **Lighthouse CI job:**
  - Pages: `/`, `/enter/` and `/help/`.
  - Errors: LCP ≤ 1.8 s, CLS ≤ 0.05, Accessibility 100, Best Practices 100.
  - Warnings only: TBT and the Performance score.
  - It uses devtools throttling (the reason is in the PR).
- **axe in Playwright:**
  - Zero WCAG 2.2 AA violations on the signed-out and Browse screens, light and dark.
  - It fixed the Home avatar's label-in-name issue.
  - It waits for animations to settle before measuring.
- **CSP and headers:**
  - `postbuild` hashes each page's inline scripts into a `<meta>` CSP.
  - The static headers come from `scripts/csp/policy.mjs`, are written to `vercel.json` and
    `infra/caddy/security.caddy`, and `csp:check` fails if they're out of date.
  - The static headers are HSTS, nosniff, no-referrer, frame-ancestors none, and the microphone
    allowed only on `/dump/` and `/express/`.
  - e2e runs under the production headers, and a spec fails on any CSP violation.
- **MSW mocks:**
  - `mock()` is typed against the contract, and the fake data is deterministic.
  - Feature mocks exist for auth, home and tasks.
  - They're used by Vitest automatically, by Playwright through `useMocks(page)`, and in dev with
    `NEXT_PUBLIC_MOCKS=1`.
- **Follow-ups:**
  - Animations: only elements with a transition class animate, at the comfort-setting speed, and
    they respect reduced motion. The old blanket rule faded every property.
  - Prerendering: `/enter/`, its sub-pages and `/shared/` now ship their content in the static
    HTML (`src/lib/nav/query.tsx` and `scripts/routes.mjs`). `/enter/` LCP went from about 3.2 s
    to about 1.55 s.

## Picked up on 2026-10-31

The red CI on `e018ab6`, fixed in a later commit on the same branch:

- **e2e coverage gate.**
  - All 76 tests passed, but coverage was just under every threshold (lines 76.5% against 78%).
  - The cause was the new `src/common/openapi/example.ts`. The e2e suite doesn't run it; unit
    tests and `openapi:check` do.
  - `src/openapi.ts` and `src/common/openapi/**` are now excluded from e2e coverage, as proposed
    above, with the owner's go-ahead.
  - Coverage is now 79.4% lines, 76.9% statements, 77.6% functions and 67.3% branches. Every
    threshold passes, and the thresholds are unchanged.
- **audit and image (new since the log above).**
  - Both failed on one new high advisory: decode-uri-component 0.2.2, through minio 8 and
    query-string 7.
  - It's fixed with an override and a one-line `pnpm patch` of query-string, not with an ignore
    list. The reasons are in B-47.
  - Checked locally: `pnpm audit` exits 0, and Trivy is clean on the built image.
  - The image is 103 MB compressed. It was built without BuildKit, because this machine has no
    buildx.
- **PWA audit gate (missing).**
  - PWA ENGINEERING_RULES §9 and §17 require `pnpm audit`, but CI had no audit job. CI now has
    one (`505b654`), the same as the backend's.
  - It found two high postcss advisories. Next 15 pins postcss 8.4.31; `next>postcss` is now
    overridden to 8.5.32.
  - postcss only runs at build time. The built CSS is byte-identical to the build with 8.4.31.
- **PWA 200% text reflow (real bug, flaky test).**
  - On a 390 px WebKit screen at 200% text, the Harder/Lighter feelings tabs scrolled sideways by
    20 px. The tabs now wrap (`6453fa0`).
  - The e2e check had measured before the screen rendered, so it passed about 9 runs in 10.
  - It now waits for the rendered screen. Without the fix it fails every time.
- **Gotcha:** `next build` (and so `pnpm check`) fails with "no direct app page entry found for
  /_not-found" while `next dev` is running in the same checkout. They share `.next/`. Stop the
  dev server before running the check.

## Left to do

### Blocking backend #99

2. **GitGuardian (red).**
   - It flags the throwaway CI Postgres password (`figcit`) in the first commit, `9784f16`. The
     current head has no such literal, and gitleaks passes.
   - To clear it, either mark incident 38972544 as a false positive in GitGuardian, or squash the
     branch and force-push. The force-push needs the owner's permission.

### After review and merge (owner's call)

3. Review and merge both PRs. They're tier-A, so they need OadeO6's approval.
4. Push the tag `engine-v1.1.0` to publish the first engine release.
5. Make the CI jobs required checks in branch protection (both repos).

### Not doable from the build container

6. Vercel previews and a hosted Lighthouse run against them.
7. GlitchTip: set `NEXT_PUBLIC_GLITCHTIP_URL` so it's allowed in `connect-src`.
8. Legal confirmation of the six BlueOak-1.0.0 licence exceptions (B-46).

### Smaller follow-ups

9. Lighthouse TBT (about 200–290 ms against 150) and the Performance score (0.93–0.96 against
   0.95) only warn. Tighten them to errors once CI runners give stable numbers.
10. Mocks exist for auth, home and tasks only. Other features add `mocks.ts` as they need one.
11. Gated routes still prerender only a skeleton, because the session is only known in the
    browser. That's inherent to the static export.
