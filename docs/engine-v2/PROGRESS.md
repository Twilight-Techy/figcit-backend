# Engine v2: build progress

The full build described in `DESIGN.md` and settled in `DECISION_LOG.md`. Tick items as they land. Branch: `engine-v2/rules-redesign`. Ships as one piece and merges to `main` after final testing and refinement (E-08).

## M1 Rule store
- [x] Workbook reader: every tab read word for word into records with references, sheet rows and cell ranges; import report (`packages/engine-v2/src/ruleset`, tests against the real workbook)
- [x] Reader keeps cell columns and table frames; writer puts a version back into the workbook's tabs; round trip tested on the real workbook (E-28)
- [x] Canonical JSON (RFC 8785) and the version document that is hashed (E-26)
- [x] Prisma models and migration: versions, rows, gaps, decisions, hash-chained audit log; database guards (`apps/api/prisma/schema/rulesets.prisma`)
- [x] Import into a draft version (CSV tabs), keeping rule IDs across re-imports; SHA-256 hash on submit (`apps/api/src/modules/rulesets`)
- [x] Version lifecycle: draft, in review, published, retired, discarded; rollback by publishing a copy
- [x] Row add, edit, retire and restore in a draft; history per rule; audit log with chain check
- [x] Gap and decision registers; exempt safety rows block publishing until their gap is acknowledged (E-21)
- [x] Export back to the workbook layout (CSV per tab)
- [x] `clinical_admin` role; only it changes rules (E-34)
- [ ] `.xlsx` import and export with shaded engine columns (T-06)
- [ ] Published version bundle in object storage, named by hash (T-07)

## M2 Rule format
- [x] Facts, conditions, effects as a declarative registry; validator and JSON Schema generated from it, checked to agree (E-36, E-37, E-38)
- [x] Catalogue of standard values, filled from the workbook on import (193 exact, 8 interpreted); input mappings table (empty until M3)
- [x] Editor accepts and checks engine columns; submit re-checks every live row; publish refused while any row or catalogue value is invalid
- [x] `GET /v1/rulesets/{label}/format` for the staff app (E-36)

## Check-in input fix (E-39 to E-46; done 1 Nov 2026)
- [x] Check-in options as rule set data; public `GET /v1/check-in/options`; bundled copy for the app
- [x] Check-in contract: unrated feelings, several supports, skipped state, rules between answers; Browse on the server, not stored
- [x] Custom places API; seed publishes the v2 rule set
- [x] PWA (`figcit-pwa`, branch `engine-v2/checkin-input`): screens rebuilt to Figma, `docs/FIGMA_DECISIONS.md`
- [x] Test server redeployed from the branches; deep links fixed

## M3 Engine columns for every rule tab
- [x] Mapping file mechanism, applied on import with a coverage report (E-48)
- [x] States, bands and band rules (Tabs 1, 10); reference tabs 5, 8, 11, 12
- [x] Context, sensitivity, timelines, demand characteristics, needs (Tabs 3a, 3b, 4, 6, 6b); tool catalogue (E-49)
- [x] Experience triggers (Tab 2) (E-50)
- [x] Patterns 1 to 41, non-negotiables (Tab 7) (E-50)
- [x] Reflect and Meditate gates, tools and entitlements (Tabs 6c, 6d) (E-50)
- [x] Decision sequence and journey layers (Tabs 8, 11): reference (E-48)
- [x] Each row marked exact, interpreted, unresolved or reference: 354 rule rows, none pending; unresolved rows open a gap on import (E-50)
- [x] Catalogue fills for sensation groups and tools; the input mappings (E-19, E-40, E-49)
- [x] Format check refuses a rule that reads a derived fact before its stage (E-50)

## M4 Engine
- [x] Stages on the rule set; requirements and proposals; exempt rules skipped (`packages/engine-v2/src/engine`, E-51)
- [x] Two trace levels: light (rule IDs fired) and full (every rule checked, facts per stage, each proposal's fate)
- [x] Re-check and recovery (RC-1 to RC-5 at capacity fit, Blue as an overlay)
- [x] Checks before publish: 8 fixed rules on a 3,468-input sweep; breaks recorded as gaps, publish blocked until acknowledged (E-51)

## M5 API and records
- [x] `POST /v1/decisions` (signed in and Browse): check-in to input facts, the published engine, the card (E-52)
- [x] Decision records (append-only), replay, daily replay job; unlinked on account deletion
- [x] Staff API: simulate and explore on any version; registers were M1 (E-52)

## M6 Staff app (client repo, after the restructure; E-31, E-33)
- [ ] Viewer in the workbook layout, filters, row history
- [ ] Simulator: pick inputs, see the output stage by stage (E-18)
- [ ] Editor: add and edit a single rule, impact check, publish (E-12, E-20)
- [ ] Gaps and exemptions, import and export
- [ ] Redesigned old admin screens: content, decisions, safety events, overview, staff and roles, research, audit

## M7 Explorer, query and impact
- [ ] All-flows explorer, outcome maps, rules that never fire
- [ ] Query, impact report, exhaustive check for safety rows (E-21)

## M8 App
- [ ] Rewire the PWA to the server-only engine; remove `vendor/engine`; Figma S81 wording (U-01, U-02)
- [ ] Retire the PWA `/admin` screens (U-03)
- [ ] Squash the branch's migrations into one before the PR (E-34)

## M9 Finish
- [ ] Full tests, coverage, performance budgets, ADR for the exceptions (E-23)
- [ ] Merge to `main`
