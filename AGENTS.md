# AGENTS.md: figcit-backend

Instructions for any coding agent (Claude Code, OpenCode, others) working in this repo. Humans: see `docs/WORKFLOW.md` for the reasoning.

## What this is
The backend for NUCCESS, a neuro-affirming support app by Figcit Ltd. NestJS + Prisma + PostgreSQL, a pg-boss worker, and `@figcit/engine`, the pure recommendation engine that the PWA (`figcit-pwa`) also bundles.

## Read before working
1. The issue you were given (acceptance criteria and **Touches**).
2. `docs/ENGINEERING_RULES.md`: binding. Budgets, organisation, security, error handling.
3. `docs/SYSTEM_DESIGN.md`: the section for the module you're touching.
4. `docs/specs/`: the source documents. The rules workbook (`docs/specs/rules-engine-v3.3/`) is the authority for engine behaviour.
5. `docs/CONFLICTS.md`: open product decisions. Don't decide them; use the item's recommendation and say so in the PR.

## Session protocol
1. **One issue per session.** Confirm the issue is assigned to your human, is *Ready* (everything under **Depends on** closed) and is claimed with `status:in-progress` (or *In progress* on the Project, once that works). If it isn't, stop and ask. Picking and claiming rules: `docs/WORKFLOW.md` section 12.
2. Work in **your own git worktree** on branch `<initials>/<issue-number>-<slug>`, created from the latest `origin/main`. Never work on `main` or on another person's branch.
3. `git pull --rebase origin main` at the start and before opening the PR.
4. **Stay inside the Touches list** and your lane (`docs/WORKFLOW.md` section 2). If the change needs more files or the other lane's files, comment on the issue and stop or narrow the change.
5. Run `pnpm check` (lint, types, tests, budgets) until it passes.
6. Open a pull request with `.github/pull_request_template.md` filled in, linked to the issue (`Closes #N`), a conventional-commit title and the issue's labels. Mark it ready, swap the issue's label to `status:in-review`, and turn auto-merge on. If the issue is `tier-a` but no CODEOWNERS path changed, request the other person's review and leave auto-merge off until they approve (`docs/WORKFLOW.md` section 12.4).
7. Stop.

## Hard rules
- **Identity first:** before any GitHub write (PR, comment, label, board update), check which account your GitHub tool is signed in as (`get_me` or `gh api user`). If it isn't the person running this session, stop and ask. Never change git `user.name`/`user.email` (`docs/WORKFLOW.md` section 11).
- **Never approve a pull request**, including your own. Approval is a human action.
- **Merge a pull request only when Twilight-Techy or OadeO6 explicitly asks you to merge that PR** in the session. Otherwise leave merging to auto-merge or a human.
- Never push to `main` or force-push a branch you didn't create. Never merge a tier-A PR (`.github/CODEOWNERS` lists tier-A paths) unless asked as above.
- Never hand-merge generated files: `pnpm-lock.yaml`, `openapi/openapi.json`, engine fixtures. Take one side and regenerate (`docs/WORKFLOW.md` section 3).
- Prisma: edit only your module's file in `apps/api/prisma/schema/`; one migration per PR, regenerated after rebasing.
- `packages/engine` stays pure and dependency-free (engineering rules 2.2).
- Follow-up issues (bugs outside **Touches**, cut scope, `TODO` links) use the `task` template, the full labels and the owning lane's assignee; write cross-repo references in full (`Twilight-Techy/figcit-backend#N`).
- No product decisions. Put questions in the issue with the `needs-decision` label and move on.
- No new dependency without the justification the engineering rules require.
- No secrets, real user data or production tokens in code, prompts, issues or PR text.
- Don't edit `docs/SYSTEM_DESIGN.md`, `docs/ENGINEERING_RULES.md`, `docs/CONFLICTS.md` or `docs/WORKFLOW.md` unless the issue asks for it.

## Cross-repo work
If the PWA needs a new or changed endpoint: first a **contract PR** (zod schemas, route returning `501`, regenerated OpenAPI), then the implementation in a separate PR. Contract changes after merge are additive only (`docs/WORKFLOW.md` section 6).

## Commands
These arrive with the S0 setup; until then, check `package.json`.
- `pnpm install`: install (frozen lockfile in CI)
- `pnpm dev`: API and worker on a free port
- `pnpm check`: everything CI runs
- `pnpm test` / `pnpm test:e2e` / `pnpm bench`
- `pnpm db:worktree`: create this worktree's own local database
- `pnpm db:migration <name>`: create a migration
- `pnpm openapi:generate`: regenerate the OpenAPI file
- `pnpm fixtures:generate`: regenerate engine fixtures from the workbook (Lane A)
