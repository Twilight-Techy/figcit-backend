# Engine v2: development TODO

Things deliberately left simple or deferred during early development, to be tightened before this branch merges to `main` or before launch. Each line says why it was deferred and where the decision is recorded.

## Before merge to `main`

| # | To do | Why deferred | Recorded in |
|---|---|---|---|
| T-01 | Decide who may grant `clinical_admin` (E-34); separate editor role; Product Owner approval of every change; Clinical Safety co-approval of `safety` rows; nobody approves their own change | Early development: one clinical admin for now | `DECISION_LOG.md` E-20; `OWNER_DISCUSSION.md` O-07 |
| T-02 | Replace every `interpreted` input mapping with the founder's confirmed value | Built from the workbook and Figma to unblock the engine | E-19; `INPUT_GAPS.md` |
| T-03 | Resolve every exempt rule or have the Clinical Safety lead acknowledge it | Exemptions are working defaults | E-11, E-21; O-18 |
| T-04 | Remove the engine from the PWA (`vendor/engine`, `scripts/sync-engine.mjs`); change Figma S81 wording; point the app at the server-only engine | The app keeps working on the old engine until v2 is live | E-01, U-01, U-02 |
| T-05 | Retire the PWA's `/admin` screens once the staff app in the client repo covers them | Same | E-31, U-03 |
| T-06 | `.xlsx` import and export, with the engine columns shaded to the right of the workbook's own | Needs a spreadsheet library, chosen under the dependency rules | E-28 |
| T-07 | Store each published version as one immutable bundle in object storage, named by its hash | The database rows and hash already prove the content; the bundle is a second copy for replay and audit | `DESIGN.md` §9 |
| T-16 | Move the AI fallbacks (map-feeling, parse-need, suggest-drivers, split-tasks) onto the v2 options, so they only suggest offered codes | They still use the v1 lists; the app filters for now | E-44 |
| T-17 | Remove the temporary v2 → v1 check-in adapter when the v2 engine runs | The v2 engine is M4 | E-39 |
| T-18 | The card's wording reads "you're feeling very high low" for a Hopeless check-in: a v1 card template joins the intensity word and the family word | v1 card copy; out of the check-in fix | E-39 |
| T-19 | The PWA's CSP script reads `NEXT_PUBLIC_API_URL` from the shell, not from `.env.production.local`; a build without it exported blocks every API call | Found while redeploying the test server | — |
| T-08 | Clinical Safety lead confirms or changes every row marked `safety` on import | Marked from a list to unblock the publish gate | E-25 |

## Before launch

| # | To do | Why deferred | Recorded in |
|---|---|---|---|
| T-10 | Enable encryption of decision records; settle replay against hashing, Browse and deletion; agree retention | Not encrypted at this stage | E-13; O-15, O-06 |
| T-11 | Clinical sign-off of every `safety` row, recorded on the row | Interim rulings | O-11 |
| T-12 | Privacy notice and PRD US-M01-03 updated for what Browse stores | Browse records are stored | O-02, O-15 |
| T-13 | SF-2 against "we do not monitor": change the feature or the notice | Open | O-12 |
| T-14 | Confirm the provisional product decisions | Build used recommendations | O-14 |
| T-15 | Confirm trace and export are staff-only | Working default | E-21; O-16 |
