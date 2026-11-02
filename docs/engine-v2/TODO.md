# Engine v2: development TODO

Things deliberately left simple or deferred during early development, to be tightened before this branch merges to `main` or before launch. Each line says why it was deferred and where the decision is recorded.

## Before merge to `main`

| # | To do | Why deferred | Recorded in |
|---|---|---|---|
| T-01 | Decide who may grant `clinical_admin` (E-34); separate editor role; Product Owner approval of every change; Clinical Safety co-approval of `safety` rows; nobody approves their own change | Early development: one clinical admin for now | `DECISION_LOG.md` E-20; `OWNER_DISCUSSION.md` O-07 |
| T-02 | Replace every `interpreted` input mapping with the founder's confirmed value | Built from the workbook and Figma to unblock the engine | E-19; `INPUT_GAPS.md` |
| T-03 | Resolve every exempt rule or have the Clinical Safety lead acknowledge it | Exemptions are working defaults | E-11, E-21; O-18 |
| T-04 | ~~Remove the app's engine copy~~ Done (E-59): the server runs the only engine; the app's typed-text check and Browse task order call it; `vendor/engine` is deleted | — | E-01, U-01, U-02, E-53, E-59 |
| T-05 | ~~Retire the PWA's `/admin` screens once the staff app in the client repo covers them~~ Done (E-54, E-55) | — | E-31, U-03, E-55 |
| T-06 | `.xlsx` import and export, with the engine columns shaded to the right of the workbook's own | Needs a spreadsheet library, chosen under the dependency rules | E-28 |
| T-07 | Store each published version as one immutable bundle in object storage, named by its hash | The database rows and hash already prove the content; the bundle is a second copy for replay and audit | `DESIGN.md` §9 |
| T-16 | Move the AI fallbacks (map-feeling, parse-need, suggest-drivers, split-tasks) onto the v2 options, so they only suggest offered codes | They still use the v1 lists; the app filters for now | E-44 |
| T-17 | Remove the temporary v2 → v1 check-in adapter when the v2 engine runs | The v2 engine is M4 | E-39 |
| T-19 | The PWA's CSP script reads `NEXT_PUBLIC_API_URL` from the shell, not from `.env.production.local`; a build without it exported blocks every API call | Found while redeploying the test server | — |
| T-08 | Clinical Safety lead confirms or changes every row marked `safety` on import | Marked from a list to unblock the publish gate | E-25 |
| T-20 | Founder confirms the interpreted readings of Tabs 2, 6c, 6d and 7 (the list in E-50), the 2 unresolved rows (recurring struggle), and the engine's card choices to review in E-51 | Read from the text to unblock the engine | E-50, E-51 |
| T-21 | Write the text of the 95 card wording keys (`copyKeysOf()`); Clinical Safety and Partnership sign-off for the support-screen, prompt and faith-related wording (Tab 6c owner note) | Keys only until the engine builds cards (M4) | E-50 |
| T-23 | ~~Link v2 cards to session records~~ Done for check-ins (E-53): a v2 card is a recommendation row, sessions link to it, and the re-check reads "support completed" from it. `POST /v1/decisions` (no row) still has none | — | E-52, E-53 |
| T-24 | Keep older engine releases runnable for replay (DESIGN §7); today a record from another engine version is reported as a mismatch | One engine version exists so far | E-52 |
| T-25 | Move the card's remaining presentation content (state names, meanings and icons; light labels, icons and colours) from the v1 content snapshot into the v2 rule set, then retire the v1 snapshot | The app's existing wording kept so nothing is invented during the switch | E-53 |
| T-26 | Give Adapt's adaptations (environment, scope, pace …) a v2 fact, so "Adapt" re-runs with the adapted conditions (pattern 12); today it re-runs the same input | No rule reads adaptations yet | E-53 |
| T-27 | Raise `ENGINE_VERSION` on any change to the engine's behaviour or trace once records exist outside development, and add a check that fails when the output changes without it | One unreleased engine version so far | E-52, E-53 |
| T-28 | ~~Red with Regulate declined offered only support~~ Decided and built (E-60) from the workbook, PRD and Activity Tables: Red offers Regulate, then Dump, then Connect. Clinical Safety confirms with the safety rows (T-11) | — | E-56, E-60 |
| T-29 | ~~Move the explorer to the job queue~~ Done (E-57): it runs in the worker | — | E-56, E-57 |
| T-22 | v1's timing budgets (`packages/engine/test/budget.test.ts`, p95 < 2 ms and < 1 ms) fail when `pnpm check` runs the suites in parallel on a loaded 2-core host; they pass run alone | Environment, not code; CI runs on its own runner | E-50 |

## Before launch

| # | To do | Why deferred | Recorded in |
|---|---|---|---|
| T-10 | Enable encryption of decision records; settle replay against hashing, Browse and deletion; agree retention | Not encrypted at this stage | E-13; O-15, O-06 |
| T-11 | Clinical sign-off of every `safety` row, recorded on the row | Interim rulings | O-11 |
| T-12 | Privacy notice and PRD US-M01-03 updated for what Browse stores | Browse records are stored | O-02, O-15 |
| T-13 | SF-2 against "we do not monitor": change the feature or the notice | Open | O-12 |
| T-14 | Confirm the provisional product decisions | Build used recommendations | O-14 |
| T-15 | Confirm trace and export are staff-only | Working default | E-21; O-16 |
