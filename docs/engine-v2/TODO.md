# Engine v2: development TODO

Things deliberately left simple or deferred during early development, to be tightened before this branch merges to `main` or before launch. Each line says why it was deferred and where the decision is recorded.

## Before merge to `main`

| # | To do | Why deferred | Recorded in |
|---|---|---|---|
| T-01 | Separate editor role; Product Owner approval of every change; Clinical Safety co-approval of `safety` rows; nobody approves their own change | Early development: one clinical admin for now | `DECISION_LOG.md` E-20; `OWNER_DISCUSSION.md` O-07 |
| T-02 | Replace every `interpreted` input mapping with the founder's confirmed value | Built from the workbook and Figma to unblock the engine | E-19; `INPUT_GAPS.md` |
| T-03 | Resolve every exempt rule or have the Clinical Safety lead acknowledge it | Exemptions are working defaults | E-11, E-21; O-18 |
| T-04 | Remove the engine from the PWA (`vendor/engine`, `scripts/sync-engine.mjs`); change Figma S81 wording; point the app at the server-only engine | The app keeps working on the old engine until v2 is live | E-01, U-01, U-02 |
| T-05 | Retire the PWA's `/admin` screens once `apps/admin` covers them | Same | E-15, U-03 |

## Before launch

| # | To do | Why deferred | Recorded in |
|---|---|---|---|
| T-10 | Enable encryption of decision records; settle replay against hashing, Browse and deletion; agree retention | Not encrypted at this stage | E-13; O-15, O-06 |
| T-11 | Clinical sign-off of every `safety` row, recorded on the row | Interim rulings | O-11 |
| T-12 | Privacy notice and PRD US-M01-03 updated for what Browse stores | Browse records are stored | O-02, O-15 |
| T-13 | SF-2 against "we do not monitor": change the feature or the notice | Open | O-12 |
| T-14 | Confirm the provisional product decisions | Build used recommendations | O-14 |
| T-15 | Confirm trace and export are staff-only | Working default | E-21; O-16 |
