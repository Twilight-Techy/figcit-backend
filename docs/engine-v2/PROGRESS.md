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
- [ ] `.xlsx` import and export with shaded engine columns (T-06)
- [ ] Published version bundle in object storage, named by hash (T-07)

## M2 Rule format
- [ ] Facts, conditions, effects (`DESIGN.md` §4) as types and zod schemas, with validation on save
- [ ] Input catalogue (standard values) and the four input mapping tables (E-19)

## M3 Engine columns for every rule tab
- [ ] States, bands and band rules (Tabs 1, 10)
- [ ] Experience, context, timelines, drivers, demand (Tabs 2, 3, 4, 5, 6)
- [ ] Needs, patterns 1 to 41, footer rules (Tabs 6b, 7)
- [ ] Reflect and Meditate gates, tools and entitlements (Tabs 6c, 6d)
- [ ] Decision sequence and journey layers (Tabs 8, 11)
- [ ] Each row marked exact, interpreted or unresolved; gaps recorded

## M4 Engine
- [ ] Stages 0 to 12 on the rule set; requirements and proposals; exempt rules skipped
- [ ] Two trace levels: light (rule IDs fired) and full (every rule checked, facts per stage)
- [ ] Re-check and recovery; checks before publish

## M5 API and records
- [ ] `POST /v2/recommendations` (signed in and Browse)
- [ ] Decision records, replay, daily replay job
- [ ] Staff API for rule sets, simulate, explore, registers

## M6 Admin app (`apps/admin`)
- [ ] Viewer in the workbook layout, filters, row history
- [ ] Simulator: pick inputs, see the output stage by stage (E-18)
- [ ] Editor: add and edit a single rule, impact check, publish (E-12, E-20)
- [ ] Gaps and exemptions, import and export

## M7 Explorer, query and impact
- [ ] All-flows explorer, outcome maps, rules that never fire
- [ ] Query, impact report, exhaustive check for safety rows (E-21)

## M8 App
- [ ] Rewire the PWA to the server-only engine; remove `vendor/engine`; Figma S81 wording (U-01, U-02)
- [ ] Retire the PWA `/admin` screens (U-03)

## M9 Finish
- [ ] Full tests, coverage, performance budgets, ADR for the exceptions (E-23)
- [ ] Merge to `main`
