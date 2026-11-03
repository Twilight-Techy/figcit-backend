# Engine v2: decision log

- **Status:** Living record. Every decision, every dropped idea and every deviation from Figma or the earlier docs on this branch goes here, with the reason and how to undo it.
- **Branch:** `engine-v2/rules-redesign`.
- **Decided by:** the Owner, in conversation, on 1 Nov 2026 (E-01 to E-07 are also in `DESIGN.md` §2).
- **Where this sits:** where this log and `DESIGN.md` disagree, this log wins. `DESIGN.md` is updated to match when a decision lands.
- **Related:** `DESIGN.md`, `INPUT_GAPS.md`, `OWNER_DISCUSSION.md` (points for the founder and Clinical Safety lead), `docs/adr/0004-engine-follows-workbook-rules.md`, `docs/build/DECISIONS.md` (the earlier build's `B-xx` entries) and `docs/CONFLICTS.md` (`D-xx`).

**How to use it.** Each entry has: the decision, why, what was dropped for it, what it touches, and how to revert. If a stakeholder wants one changed, change the entry and the files it names.

## Standing instruction (E-17)

We are early in development. The Owner's rule for this branch:

- Don't limit the work; do whatever is necessary.
- **Every decision, every dropped idea and every change against Figma or an earlier document is written down here**, with the reason, so it can be reviewed and reversed.
- Questions for the founder or the Clinical Safety lead go in `OWNER_DISCUSSION.md` or `INPUT_GAPS.md`, with the sources named.

## Decisions

### E-01 to E-07
See `DESIGN.md` §2. E-01 (engine only on the server, for signed-in and Browse users alike) was **confirmed again by the Owner on 1 Nov 2026**: everything about the engine is on the server; the app keeps tools and basic features only.

### E-08 Scope of this branch: the full build, not a first slice
- **Decision:** build the whole of `DESIGN.md` on this branch (rule store, importer, engine, trace, decision records and replay, the admin app with viewer, simulator, editor and approvals, explorer, query, registers, audit log). It merges to `main` only after final testing and refinement.
- **Why:** the Owner wants one finished piece, not a stage to be extended later.
- **Dropped:** a first milestone limited to import, engine, trace and a read-only viewer and simulator (proposed 1 Nov 2026).
- **Touches:** `DESIGN.md` §12.
- **Revert:** restore the staged order in §12 and stop after step 3.

### E-09 Rules are data; the code holds only mechanics
- **Decision:** the rules themselves are data in the rule store. Adding a rule, fixing one or changing a threshold is a data change, with no release. Code changes only when something major changes or the approach itself changes (a new kind of stage, a new kind of effect).
- **What stays in code:** the engine's mechanics: running the stages in order, evaluating conditions, applying effects, requirement-versus-proposal handling, building the trace. These are not "rules" in the workbook's sense.
- **Same structure as the workbook:** the rule set has the **same tabs, columns, row order and wording as the current workbook**, so the person who wrote it can read and maintain it and does not meet a new structure. Anything extra the engine needs sits in clearly marked added columns or added tables (`DESIGN.md` §3.3, §3.4). This restates and stresses E-06.
- **Why:** the author must stay in charge of the rules; the product will keep adding and correcting rules.
- **Dropped:** nothing; this sharpens E-06.
- **Open:** where exactly the line falls for effects. `DESIGN.md` §4.3 lists a closed set of effects; a new effect kind is a code change. Confirm that is acceptable (see `OWNER_DISCUSSION.md` O-17).
- **Revert:** n/a (principle).

### E-10 The example tables are not used; the rule data decides
- **Decision:** the engine follows the rule data. Tab 0, Tab 0b, Tab 9 and Tab 6d section F are **not used as tests and not as a publish gate**. There is no drift gate.
- **Why:** the Owner's ruling. The examples have errors of their own and the rules are the authority (Tab 0 itself says "the source tabs remain the authority").
- **Dropped:**
  - drift as a gate on publishing (proposed 1 Nov 2026);
  - ADR 0004 §1's "run the examples against every version and record drift". ADR 0004 is amended to say so.
- **Open:** whether to keep the example tabs imported as read-only reference. `OWNER_DISCUSSION.md` O-05.
- **Touches:** `DESIGN.md` §1, §3.6, §6; ADR 0004 §1.
- **Revert:** reinstate the drift register and a pass-or-warn check on publish (the old design is in this branch's history).

### E-11 Logically broken rules are exempted and recorded, not patched
- **Decision:** a rule that is contradictory, undefined or incomplete is marked **exempt**. The engine does not run it. It stays visible in the dashboard and gets a gap record. This is the same idea as the `unresolved` mapping status in `DESIGN.md` §3.3.
- **Each gap record holds:** the rows involved (by `source_ref`), what is broken, an example input that shows it, what the engine does while it is exempt, a recommendation, and who decides (founder or Clinical Safety lead).
- **Why:** the Owner's ruling: don't bend the engine to fit a bad rule, and don't hide it.
- **Open:** what the engine does in place of an exempt rule, especially for `safety` rows. `OWNER_DISCUSSION.md` O-18.
- **Revert:** n/a (it extends `DESIGN.md` §1 "gaps are recorded, not patched").

### E-12 The rule store is the master copy from the first import; rules can be added one at a time
- **Decision:**
  - After the first import the rule store is the master copy. The spreadsheet is an export.
  - A clinical admin can **add or change a single rule in the dashboard** without re-importing the workbook. Re-import stays possible for bulk changes.
  - The editor therefore comes early in the build, not last.
- **Why:** the spreadsheet has problems of its own, so it can't remain the master. Having the store as master with no way to edit it would leave nobody able to change a rule (`OWNER_DISCUSSION.md` O-09).
- **Dropped:** "the spreadsheet stays master until the editor is live" (proposed 1 Nov 2026), and an editor built last.
- **Touches:** `DESIGN.md` §8 (Editor), §12 (order).
- **Look and feel:** a first version, to be improved. A tab grid in the workbook's layout; "add row" or "edit row" opens a form with the workbook columns as text and the engine columns filled through dropdowns; it saves into a draft version, runs the impact check, goes to approval, then publish.
- **Revert:** restore the spreadsheet as master and move the editor to the end of §12.

### E-13 Engine v2 records are not encrypted at this stage
- **Decision:** decision records, traces and rule data are stored unencrypted for now. Encryption (the user-key scheme in `DESIGN.md` §7) is added before launch.
- **Stored inputs:** until the replay and Browse question is settled, a decision record keeps the **structured standard-value input** (codes, no free text), not a one-way hash, because replay needs the real input. This is a working default, not a ruling; see `OWNER_DISCUSSION.md` O-15, which sets out the problem, the constraints and the options.
- **Why:** the Owner: nothing is encrypted at this stage of development.
- **Pre-launch action:** resolve O-15; add encryption; fix retention on account deletion (O-06).
- **Revert:** n/a (deferral).

### E-14 Screening free text for risk language is outside this work
- **Decision:** the safety screen on typed or spoken text belongs to the AI and free-text team (E-04). This work does not build it and does not add a phrase check to the app.
- **What this work does need:** the engine accepts the result as an input (the risk flag and the form it takes: `INPUT_GAPS.md` IG-20) and the safety **rules on standard values** (the Hopeless chip, "Get support now", SF-1 and SF-2).
- **Why:** the Owner: this work is the recommendation engine and its standard inputs.
- **Dropped:** a phrase check in the app, in addition to the server screen (proposed 1 Nov 2026). The old design had one (`figcit-pwa/docs/SYSTEM_DESIGN.md` §9).
- **Open for that team:** who owns the phrase list, where it runs, and what happens offline. `OWNER_DISCUSSION.md` O-03.
- **Revert:** n/a (scope boundary).

### E-15 The admin dashboard is a separate app (replaced by E-31)
- **Decision:** `apps/admin` in the backend workspace, sharing the rule-format schemas. The PWA's `/admin` screens retire when v2 goes live.
- **Why:** staff tools stay out of the public bundle, and the dashboard shares types with the rule format (`DESIGN.md` §9). The Owner said to go ahead with whatever is necessary and note it.
- **Dropped:** keeping the admin screens in the PWA.
- **Revert:** build the dashboard as `/admin` routes in `figcit-pwa` (the old design, `figcit-pwa/docs/SYSTEM_DESIGN.md` §5).

### E-16 Changes to the app or Figma are allowed when needed, and listed
- **Decision:** if the app has to change in a way that goes against the Figma, change it and add a row to the table below.
- **Why:** the Owner: proceed, but document it.

| # | Where | Figma / earlier design says | Now | Reason | Revert |
|---|---|---|---|---|---|
| U-01 | Figma S81, "Recommendations" row | "Uses last known rules" (a card made offline) | "Available when you're back online" | The engine is server-only (E-01, E-03) | Restore the device engine in the PWA |
| U-02 | PWA `vendor/engine` and `scripts/sync-engine.mjs` | The app bundles a copy of the engine | Removed when v2 goes live | E-01 | Re-vendor the engine |
| U-03 | PWA `/admin` | Admin screens inside the app | Moved to one staff app in the client repo and redesigned | E-31, E-33 | See E-15 |

### E-18 The engine is tested through the admin Simulator, on inputs and outputs only
- **Decision:**
  - Testing before merge uses the **Simulator page in the admin app**: pick input values similar to what a real user produces and see the engine's output **stage by stage**, as a real user's run would go. The explorer runs the same thing over many inputs.
  - The engine's contract is **input values in, output out**, regardless of the app screen that collects them. The engine is tested on that contract alone.
- **Why:** the Owner: the recommendation engine is about standard input and output, not about the input interface.
- **Dropped:** a shadow run on live check-ins, and a v1-against-v2 comparison on generated inputs (both proposed 1 Nov 2026). A comparison with v1 can still be run later as an extra, but it isn't required.
- **Touches:** `DESIGN.md` §8 (Simulator), §12 step 6.
- **Revert:** reinstate the shadow run in §12.

### E-19 Build the engine as complete as we can; fill gaps where we can and record each fill
- **Decision:** don't wait for the founder's input-gap session. Where a mapping or value is missing, fill it from the workbook first, then from Figma, mark it `interpreted`, and record it. The four input mappings are their own versioned rule-set tables: chip to family, sensation to flag, environment to setting class, picture answers to cell. They're marked as additions that aren't from the workbook, and flagged `safety` where they set a safety flag.
- **Every fill is recorded** with: what was missing, what was used, the source, who should confirm it (`INPUT_GAPS.md` ID and `OWNER_DISCUSSION.md` item).
- **Why:** the Owner: build as complete as possible, record decisions for review.
- **Revert:** replace the `interpreted` rows with the founder's answers; nothing else changes because the mappings are data.

### E-20 One clinical admin role for now; tighten later
- **Decision:** there is a single **clinical admin** who can draft, add, edit, approve and publish rules. The separate editor role, Product Owner approval, Clinical Safety co-approval on `safety` rows and the rule that nobody approves their own change (`OWNER_DISCUSSION.md` O-07) are **not built yet**. They're on the development TODO (`TODO.md`).
- **Why:** the Owner: keep early development simple; tighten later.
- **Safety net kept even now:** every change is audit-logged with who and when, and every published version is immutable and can be rolled back.
- **Revert:** build O-07 as written.

### E-21 Working defaults where the Owner has not ruled yet
Built this way so work is not blocked. Each is open in `OWNER_DISCUSSION.md` and can be changed there.

| Open point | Working default | Item |
|---|---|---|
| What the engine does while a rule is exempt | Ordinary rules: behave as if the row doesn't exist. `safety` rows: publishing is blocked until the exemption is acknowledged | O-18 |
| Example tabs | Imported as read-only reference, never run | O-05 |
| Impact check for safety rows | Run the engine over all combinations of the inputs those rules read; where that is too many, all combinations of the safety-relevant inputs plus boundary values | `DESIGN.md` §8 (Editor) |
| What the public API returns | The card and the versions only; the trace and the rule-set export are staff-only | O-16 |
| What a decision record stores | Structured standard-value input (codes), not a hash; the trace is rebuilt by replay | O-15, E-13 |
| Where the data/code line sits | Closed set of effects (`DESIGN.md` §4.3); a new kind of effect is a code change | O-17 |

### E-22 Engine v2 lives in its own pure package, `@figcit/engine-v2`
- **Decision:** `packages/engine-v2` holds the rule-set format, the workbook reader and (later) the engine. It has no runtime dependencies and no Node built-ins, and the same lint, dependency-cruiser and CI checks as `@figcit/engine` apply to it. Storing, versioning, the API and the admin app sit in `apps/api` and `apps/admin` and use the package.
- **Why:** `ENGINEERING_RULES.md` §2.2 wants the engine pure and testable on its own; the importer and the engine then share one definition of the format. `DESIGN.md` §9 said "inside the NestJS API", which would have mixed the engine with storage.
- **Dropped:** putting the engine inside `apps/api`.
- **Revert:** move the code into an API module; nothing else depends on the package name yet.

### E-23 Exceptions to `ENGINEERING_RULES.md` that v2 needs
Rule §15 asks for a written exception. These are listed here and need an ADR before merge.

| Rule | What v2 does instead | Why | Cost | Revisit |
|---|---|---|---|---|
| §13 "Engine fixtures: every scenario row in Tabs 0, 0b, 6d, 9, 10 passes" | v2 is not tested against the example tabs | E-10 (Owner). ADR 0004 already says the examples are not tests. The v2 tests are written from the rules | No regression oracle from the examples | When the Owner wants them back |
| §5.3 "JSONB only for the trace, snapshot, card payloads and event properties" | Rule records keep the workbook's columns and the engine's columns as JSONB | The rule set is the snapshot, split into rows so rows can be edited one at a time (E-12). They are never filtered or joined on | None expected: the engine loads a whole version at once | If row-level queries are needed |
| §1.3 "one recommendation including trace < 4 KB" | Honoured by storing the input, the card and the versions, and rebuilding the trace by replay (E-21) | The v2 trace is larger than 4 KB | Replay must be exact (a daily check, `DESIGN.md` §7) | O-15 |

### E-24 Reader behaviour on the workbook
Recorded so a reviewer can see what the reader does with the spreadsheet (`packages/engine-v2/src/ruleset`).
- **Layout:** every tab is read as notes (one filled cell) and tables (two or more). A table's first row is its header (Tabs 0 and 0b: the row starting "Ref"). Blank rows and notes end a table.
- **Word for word:** every cell is stored exactly as written, with its column heading, its sheet row and its cell range. A test checks that no filled row is dropped and that every record matches its source row.
- **References:** the author's own ID is the reference (E1M1, T0, EX-1, RF-1, ENT-3). Tab 2 uses family plus intensity band. Tab 7's `16.0` is stored as `16` (listed in the import report). A repeated reference gets `#2` (listed in the report).
- **Examples and reference tables** (Tabs 0, 0b, 9, 6d section F, and the glossary tables under Tab 0) are stored with the role `example` or `reference`, read-only, never run.
- **Tab 7 footer** lines become the `non_negotiables` table. The first line is a heading; the rest are rules.
- **Not imported:** the workbook's "Sheet1" scratch tab (ADR 0004). It isn't in the CSV set.
- **Revert:** n/a (it is how the reader works; the layout table is `layout.ts`).

### E-25 Which rows start as `safety` on import (interpreted)
- **Decision:** on first import these rule rows are marked `safety`: Tab 2 "Immediate risk language"; Tab 7 pattern 28; Tab 10 SF-1, SF-2 and RC-5; the Tab 10 "Very Constrained" (Red) band row; Tab 8 step "0. Safety screen"; every row of Tab 6d section A (it holds the safety floor column); every Tab 7 non-negotiable. Nothing else, and never an example or note row.
- **Why:** the workbook marks no rows as safety. These are the rows that decide risk handling, the Red band, the safety floor or the rules that hold across every pattern. Marking them makes the publish gate (E-21) and later Clinical Safety approval (T-01) apply to them.
- **Who confirms:** the Clinical Safety lead, row by row; the flag can be changed in the editor (audited, with a reason). Listed with O-11.
- **Where:** `initialSafety` in `packages/engine-v2/src/ruleset/store.ts`.
- **Revert:** change the list; existing versions keep their flags.

### E-26 How versions are stored
- **Decision:**
  - Each version holds **its own copy of every row**. A rule's database ID (`recordId`, E-07) is the same in every version; the row's own ID differs per version. History of a rule is the rows with its `recordId`.
  - **Re-import keeps IDs:** a row keeps the ID it had in the latest version when its tab, section and reference match. A renamed reference gets a new ID (the history link is lost for that row; the audit log still shows both).
  - **Hash:** SHA-256 of the canonical JSON (RFC 8785) of the format number, workbook version, table frames and every row's content (cells, engine columns, mapping, status, safety, tag, origin). Database IDs, labels, who and when are left out, so equal rules give an equal hash.
  - **One open version at a time** (a draft or a version in review), and one published.
  - **Rollback** publishes a **copy** of the older version under a new label (e.g. `3.3-r3`); its hash must equal the original's. The history of what was live when stays a straight line.
  - **Database guards:** triggers refuse any change to rows of a version that is not a draft, any change to a published version other than retiring it, any change to retired or discarded versions, and deleting anything but a draft. The rule store audit log is append-only.
  - **Audit log:** its own table (`ruleset_audit_events`), hash-chained: each entry's hash covers the previous hash and the entry. `GET /v1/rulesets/audit/verify` re-checks the chain.
- **Why:** DESIGN §3.5 and §7; single-row edits (E-12) need rows, not one big document; copying a few hundred rows per version is cheap.
- **Dropped:** storing only changed rows per version (saves space, but makes every read a merge across versions).
- **Revert:** n/a (storage design); the hash does not depend on it.

### E-27 API paths are `/v1/rulesets/...`
- **Decision:** the staff rule store API is at `/v1/rulesets` (`DESIGN.md` §10 wrote `/v2/rulesets`). The app has one global prefix, `v1`, which is the **API** version; "v2" is the **engine** version. The public recommendation route for engine v2 will be named when M5 is built.
- **Why:** `/v1/v2/...` would be confusing; the API itself has not changed version.
- **Revert:** add a second global prefix or a route alias.

### E-28 Export is CSV per tab for now; `.xlsx` later
- **Decision:** `GET /v1/rulesets/{label}/export` writes a version's live rows back into the workbook's tabs as CSV, one file per tab, laid out like the sheet (the same tables, headers, grouping rows and notes, in the same order). Reading the export gives the same records again (tested on the real workbook). For this the reader now keeps each cell's column and each table's header and grouping rows (`TableFrame`).
- **Not yet:** `.xlsx` import and export with the engine columns shaded to the right, which needs a spreadsheet library under the dependency rules (`TODO.md` T-06). Uploading a workbook today means uploading its tabs as CSV, as the existing snapshot upload does.
- **Revert:** n/a.

### E-29 The engine columns can't be edited yet (lifted by E-36)
- **Decision:** until the rule format exists (M2), the editor accepts the workbook cells, `safety`, the workbook version tag and the mapping status `pending` or `unresolved` (exempt). It does not accept engine columns or `exact` / `interpreted`.
- **Why:** an engine column saved before its format exists could not be validated, and would be wrong data the day the format lands.
- **Revert:** n/a (lifted by M2).

### E-30 Gaps are acknowledged by the clinical admin for now
- **Decision:** with one clinical admin role (E-20), that role acknowledges and resolves gaps, including safety gaps. A resolved gap stays resolved; a new gap is recorded instead. An acknowledged gap can be reopened.
- **Why:** E-20.
- **Pre-merge:** safety gaps acknowledged only by the Clinical Safety lead (`TODO.md` T-01).

### E-23 addition (1 Nov 2026)
Rule set versions also keep their table frames, import report and checks as JSONB. Same reason as the rows: they are part of the version, read whole, never filtered on.

### E-31 One staff app, in the client repo, for every staff tool (replaces E-15)
- **Decision (Owner and fellow developer, 1 Nov 2026):**
  - The PWA repo is renamed to a **client** repo (e.g. `figcit-client`) that holds every client-side app. The backend repo holds only the backend.
  - The staff tools leave the user app. They become **one separate staff app** in the client repo (e.g. `apps/admin`): a standard desktop web app, responsive on mobile, never bundled with the user app.
  - The **clinical rule tools are a section of that app** (viewer, simulator, editor, gaps, versions, audit), not a separate app. The other sections are the old `/admin` screens, redesigned (E-33): content, decisions, safety events, overview, staff and roles, research, audit. Menus follow the user's roles.
- **Why:** one staff sign-in, two-step check and role model; one deploy and design system; the clinical lead needs decisions and safety events next to the rules, for tracing an incident.
- **Consequence:** the staff app can't import `@figcit/engine-v2` across repos. It uses types generated from the API's OpenAPI file, so the rule format (M2) must be fully described in the API contract.
- **Split out later if:** the clinical side must be walled off from platform data, or needs separate hosting for a medical-device boundary (`OWNER_DISCUSSION.md` O-06).
- **Dropped:** E-15 (`figcit-backend/apps/admin`, rule screens only).
- **Revert:** build the staff app in the backend repo again (E-15).

### E-32 Order of work (amended by E-39)
- **Decision:** the backend carries on (M2 rule format, M3 engine columns, M4 engine, M5 API and records) while the client repo is restructured. The staff app is built after the move.
- **Why:** the backend doesn't depend on the client repo's layout.

### E-33 Claude builds the whole staff app, and the old admin screens are redesigned
- **Decision:** Claude builds the staff app in full: the rule section and the redesign of every old `/admin` screen. The old screens are not ported as they are.
- **Why:** the Owner.
- **Touches:** the client repo, once restructured; the PWA's `/admin` is removed when the staff app covers it (`TODO.md` T-05).

### E-34 A separate clinical admin role changes the rules
- **Decision:** a new staff role, `clinical_admin`, is the only role that changes engine v2 rules (import, edit, submit, publish, roll back, gaps, decisions). A platform `admin` can read the rule set but not change it. `safety_reviewer` and `content_editor` can read it.
- **Replaces:** E-20's use of the general `admin` role. The rest of E-20 stands (one role for drafting and approving, for now).
- **Built:** `clinical_admin` added to the user roles (migration `20261101120000_clinical_admin_role`, since squashed into `20261102030000_engine_v2` (E-58); `users.prisma`, `STAFF_ROLES`, the roles screen's allowed list).
- **Open:** a platform `admin` grants roles, so an admin could grant themselves `clinical_admin`. The grant is audited. Whether only the Owner may grant it is part of O-07 (`TODO.md` T-01).
- **Note for merge:** ~~the branch now has two migrations; they are squashed into one before the PR~~ Done (E-58).

### E-35 Where the staff app is hosted
- **Working assumption:** its own subdomain (e.g. `admin.<domain>`). Not decided; it doesn't affect the work until the staff app is deployed. Its own origin keeps staff sessions and cookies apart from the user app.

### E-36 The rule format is served by the API, per version
- **Decision:** `GET /v1/rulesets/{label}/format` returns everything a client needs to show, edit and check engine columns for that version: the stages (tied to Tab 8), the precedence layers (ADR 0004 §2), the card slots and actions, every fact with its type, domain and allowed operators, every effect with its parameters and class (requirement, proposal, modifier), the size limits, the catalogue's values per domain, and the JSON Schema (2020-12) of engine columns with those values filled in. The staff app builds its editor from this response, not from code.
- **One source:** a declarative registry in `@figcit/engine-v2` (`src/format/registry.ts`) produces the validator, the JSON Schema and the description. A test runs the same sample rules through the validator and through a standard JSON Schema validator (Ajv) and requires the same verdict.
- **Checked twice:** on save (the editor refuses a row the engine couldn't run, listing every problem with its location) and on submit (every live row against the version's own catalogue; a renamed or removed value that a rule still uses blocks publishing, code `ruleset_invalid`).
- **Two rules the schema can't state** are checked on save only: a row that proposes needs a `layer`; conditions stay within the size limits (6 deep, 64 parts).
- **Why:** the Owner's suggestion (1 Nov 2026); a new fact value or threshold then needs no staff app release, and an old version shows the format it was written in.
- **Lifts E-29:** engine columns and the `exact` / `interpreted` statuses can now be set in the editor.

### E-37 Format 2: engine columns, the catalogue, input mappings
- **Format number** raised to 2. Versions stored at format 1 exist only in development databases; they have no catalogue and are not upgraded (nothing outside development used them).
- **Engine columns** of a rule row: `stage`, optional `layer`, 1-16 `rules` (each a condition or `null` for "always", and 1-12 effects), optional `interpretation` (required when the mapping is `interpreted`). A row may need several rules (a pattern's primary, alternatives and conditions).
- **Conditions:** `all`, `any`, `not` and comparisons on a fact. Operators by fact type: enum `eq ne in not_in present absent` (plus `gte gt lte lt` on ordered domains); set `contains not_contains contains_any contains_all empty not_empty`; number `eq ne gte gt lte lt present absent`; intensity `gte gt lte lt present absent`; boolean `is`. An intensity can be compared with a number (0-10) or with an intensity band (`{ "band": "high" }` stands for its lower bound, 7). A comparison on a fact that is absent is false.
- **Thresholds are data:** the intensity bands and their ranges (Mild 0-3, Moderate 4-6, High 7-8, Very High 9-10, from the Tab 2 note) are catalogue rows, so no number sits in code (workbook README).
- **Order:** comparisons on an ordered domain use the catalogue `Order`. For bands that is the workbook's own Tab 10 `Order` column: 0 = Very Constrained up to 3 = Available. `band.lower` moves to a lower Order; `band.cap` sets how low the band may go (e.g. E4M1 stops at Constrained).
- **Mechanics stay in code** (E-09): the facts the engine computes, the operators, the effect kinds, the card slots (`primary`, `alternative`, `queued`, `visible`) and the card actions (`get_support_now`, `try_anyway`, `skip_to_task`, `start_small`, `save_for_later`), because each has fixed behaviour in the engine or the app. Adding one raises the format number.
- **The catalogue** (`x-catalogue.csv`, an added table: Domain, Code, Label, Order, From, To, Group, Source, Note) holds every standard value. On import it is filled from the workbook rows that define each value: 193 values marked `exact` (16 cells, 4 bands, 5 lights, 33 families, 4 intensity bands, 8 flags, 19 contexts, 9 timelines, 8 drivers, 17 demand characteristics, 21 needs, 8 pathways, 41 patterns) and 8 marked `interpreted` (setting classes public, formal, observed, unfamiliar, caring, from CX-1 and Tab 3b; plans free, plus, institution, from Tab 6d). Each row names its source row. Tab 3b's last row ("ALL public, formal, observed or caring settings") is a rule about settings, not a setting, and is left out (named in the import report). Codes are made from the labels (`Anxious / fearful` → `anxious_fearful`); cells, timelines and patterns keep the author's references (`E1M1`, `T0`, `28`).
- **Not filled yet (M3, E-19):** sensation groups, tools and the four input mappings (chip to family, sensation to group, environment to setting class, picture answers to cell). A rule that names a value the catalogue doesn't have is refused with "the catalogue has no … values yet".
- **Input mappings** (`x-input-mappings.csv`: Mapping, From, To, Source, Note) start empty.
- **Export and re-import** carry both added tables; an upload that includes them keeps them as given instead of filling them again.
- **New mapping status `reference`:** the row states nothing the engine runs (a definition whose values are in the catalogue, or a description). Notes, examples and reference tables may only be `pending` or `reference`; catalogue and mapping rows record provenance (`pending`, `exact`, `interpreted`) and never carry engine columns.
- **Revert:** n/a (format); later changes raise the format number.

### E-38 Ajv as a test-only dependency of `@figcit/engine-v2`
- **What:** `ajv` 8.20.0 in `devDependencies` only; the package still has no runtime dependencies (CI check).
- **Why:** it is the reference JSON Schema validator; the test that the generated schema and the package's own validator agree needs an independent implementation, not ours.
- **Cost:** none at runtime; it was already installed (fastify uses it); MIT licence.

### E-39 The check-in is fixed now, against a v2 input contract (amends E-32)
- **Decision (Owner, 1 Nov 2026):** the user app's flow from sign-in to the engine input is fixed now, before the v2 engine exists. The app sends **standard values from the v2 rule set**:
  - the options come from a public endpoint built from the published rule set (E-40);
  - the server checks every value against it;
  - until M4, the server converts the input for the v1 engine (a temporary adapter, removed when v2 runs).
- **Also decided:**
  - Browse check-ins go to the server (E-01, E-02, E-05).
  - Offline, the check-in is saved on the phone and the card is made when back online (E-03).
  - The engine copy in the app is removed.
- **Work:** `figcit-pwa`, branch `engine-v2/checkin-input`. The repo will be renamed later; it doesn't affect this.
- **Revert:** n/a.

### E-40 Check-in options are rule set data (input mappings, format 2)
- **Decision:** what the check-in offers is a table in the rule set: feeling chips, sensations, places, who's around, time, support, senses, needs, task kinds and timelines, the Not-sure pictures and body regions. Each option has:
  - a stable code;
  - the label the user sees (Figma's wording);
  - its group (tab or side);
  - its order;
  - what it **maps to** in the catalogue (e.g. the chip `anxious` → family `anxious_fearful`).
- **Public endpoint:** `GET /v1/check-in/options` (public, with an ETag) serves the published version's options. The app caches it for offline use.
- **Option codes** stay the codes v1 used where v1 had the same option, so the temporary v1 adapter (E-39) needs no translation.
- **Filled from Figma** (S07, S09–S09e, S10, S11, S12, S150, S152), each row `interpreted` with its Figma node as the source, for the founder to confirm (E-19). The 13 feeling chips and 16 places that v1 invented are dropped.
- **Sensation groups** the sensation-led rules read are added to the catalogue, `interpreted` from Tab 2, MD-2 and PRD FR-M03-02: pain, shutdown, detached, racing, word-finding, restless, hyperfocus, interoception unmet and sensory overload.
- **Revert:** n/a (data; the founder edits the rows).

### E-41 No value the user didn't choose
- Both Energy and Mood must be picked; nothing is pre-set.
- A feeling's intensity is `null` ("not rated") until the slider is moved; "Skip intensity" sends `null`, never 5.
- Sensation strength is optional and per tab.
- An optional question left blank is sent as "not answered"; "None right now" is its own answer.
- "Suggested from last time" fills in only **where you are** and **who's around**.

### E-42 Interim: what an unrated feeling counts as (needs Clinical Safety)
- **Decision (made by Claude on the Owner's instruction, for review):** until the Clinical Safety lead rules, the engine treats an unrated feeling as:
  - **High (7)** when its family lowers the band (EX-1) or touches safety;
  - **Mild (2)** for lighter families.
- **Assumption:** the cost of under-supporting someone who skipped is higher than the cost of a gentler card.
- **Where:** the v1 adapter now (E-39), and an engine rule in M3.
- **Review:** OWNER_DISCUSSION O-19.

### E-43 Tapping "Hopeless" offers support at once (needs Clinical Safety)
- **What it is:** the Hopeless chip is a "selected option" under SF-1 and maps to the family "Immediate risk language", so the safety override fires at any intensity (ADR 0004 §7).
- **The new prompt:** as soon as the chip is tapped, the app shows a small prompt, "Want support right now?", with **Get support now** (opens Help/SOS) and **Keep going**. It doesn't block the user. The card at the end is the safety card either way.
- **Not this:** the danger-words check on typed text belongs to the free-text team (E-14) and is unchanged.
- **Review:** OWNER_DISCUSSION O-19.

### E-44 Stand-ins for the AI steps while they are off
- **Decision (Owner):** the AI steps (map-feeling, parse-need, suggest-drivers, split-tasks) are treated as if they work.
- **No new stubs were needed.** With no model configured, the server already answers each step with its rule-based fallback (`apps/api/src/modules/ai/fallbacks`), and those results stand in for the model.
- The app keeps Figma's own-words fields and the S92 "drivers detected" card as designed.
- The fallbacks still suggest v1 codes, so the app keeps only suggestions that are on its option lists.
- **Rejected:** extra task toggles that aren't in the flow (proposed 1 Nov 2026).
- **Clean-up:** `TODO.md` T-16 (move the fallbacks onto the v2 options).

### E-45 Smaller check-in rulings (1 Nov 2026)
- "Support available" allows several picks; "Just me" and "Someone with me" exclude each other.
- "Somewhere else" lets the user name a place and say what it's most like (a standard place). It is saved as their own chip; the engine sees only the standard place; the name is encrypted (S10 merged with S90).
- Places: Figma's 10 chips come first, each linked to a workbook place; "More places" shows the remaining workbook places.
- Needs that need a task (Tab 6b "Works with no task? No") make the task step required. "More needs" shows the Tab 6b needs Figma leaves out, except "Get urgent help", which is the Help button. "I'm grateful, I want to note it" maps to the gratitude family.
- Quick entry ("I need help with…"): need first, then the Energy × Mood step, which can be skipped. A skipped state goes to the engine as "not given" (NS-1 keeps it Conditional).
- Re-check: energy and mood, then the original check-in's feelings re-rated (skippable), so RC-1 can be measured.
- Sensations: Figma's tabs and placement. "Feel detached or unreal" is added to Cognitive because MD-2 needs it (a recorded drift from Figma).
- Not sure: answers map to a cell through the input mappings (energy → E, comfort → M, `interpreted`). The body answer is kept but not used yet. The "we'll start with your body" message is removed.
- Onboarding follows Figma's order. Buttons with nothing behind them (institution sign-in, Apple, passkey) are hidden until built. The consent screen uses the FigCit name and a true Browse sentence.
- Visual and design changes against Figma are listed in `figcit-pwa/docs/FIGMA_DECISIONS.md`. Anything that differs from Figma and isn't listed there is a bug.

### E-46 Browse check-ins run on the server and are not stored yet
- **Decision:** a Browse check-in (no account) is checked and run on the server like any other, and its card returned (E-01, E-02).
- **Not stored yet:** the existing check-in tables need a user and that user's encryption key. The record E-05 asks for comes with the v2 decision records (M5).
- **Until then:** the app keeps the Browse check-in and card on the device, as before. This also keeps PRD US-M01-03 ("Browse stores nothing on the server") true until O-02 is settled.
- **Revert:** store Browse records once M5 exists (E-05).

### E-47 Card sentences use intensity words that read as English
- **Decision:** the card's "because" sentence names intensity as **mild, moderate, strong, very strong**. It no longer uses the band names: "very high" produced "you're feeling very high low". The sadness phrase ends in a noun ("you're feeling very strong sadness"), like the others.
- **v1 now:** engine 1.1.2, with a test that every intensity reads correctly.
- **v2:** the card wording in M4 uses the same words.
- **Revert:** n/a (wording fix; was TODO T-18).

### E-48 How rows get their engine columns (M3), and format 3
- **The mapping file** (`packages/engine-v2/src/mapping/`, one file per group of tabs) gives each rule row, by its reference, a status (`exact`, `interpreted`, `unresolved` or `reference`), its engine columns and a reason. An interpreted row stores its reason as the interpretation the author confirms.
- **On import:** the mapping file is applied, and the import report shows coverage per tab, mapping entries that found no row, and rows whose mapping failed the format check. Those rows stay `pending`, never stored half-right.
- **Notes, examples and reference tables** become `reference` automatically; they never run.
- **Mapped so far:**
  - Tab 10: band rows and all 14 modifier rules.
  - Tab 1: E2M1, E3M1, E4M1 and E4M2 lean "regulate first" (ADR 0004 §6). The other cells are reference: their band comes from Tab 10.
  - Tabs 5, 8, 11 and 12 are reference: definitions and descriptions.
- **Format 3 adds:**
  - effects `band.set` (the baseline), `band.limit_drop` (CAP-1), `band.limit_rise` (RC-3, RC-4), `light.never` (RC-5) and `classes.add` (Tab 3b's setting classes);
  - facts `recheck.previous_band`, `recheck.band_improved`, `recheck.support_completed` and `signals.safety_event_recently`;
  - a rule may name its own stage (a band row sets the baseline in State and its light after the modifiers).
- **Interpretations for the author to confirm** are in the mapping file's reasons and in the dashboard:
  - CX-1: "negative experience family" read as the harder Tab 2 families.
  - RC-1: "better cell" read as a higher baseline band.
  - RC-2: Routine and at most 3 steps.
  - RC-5: support visible while the clinical pathway is undefined.
  - SF-2: either clause.
  - Amber: Urgency kept (ADR 0004 §9).
- **Revert:** n/a (method); each row's mapping can be changed in the file or the editor.

### E-49 Tools, supports and Tabs 3a, 3b, 4, 6, 6b mapped (M3)
- **Tool catalogue:** Tab 6d names each pathway's tools in prose and gives no codes. 79 tools get codes, grouped by pathway, each naming its Tab 6d row. v1's code is kept where it was the same tool (`settle_3`, `body_scan`, `step_out`...).
  - All rows are `interpreted`.
  - The tier (free, advanced, safety floor) stays a rule of the Tab 6d rows, not a property of the tool.
- **Supports:** a `support` value list (just me, can call someone, someone with me, headphones) and the `context.supports` fact, because Tabs 3a, 3b and 6c read headphones. The check-in's support options map to it.
- **Tab 3b:** each place gives its setting classes (`classes.add`) and the tools it excludes.
  - "Sounds (headphones)" reads as no Sounds unless headphones are available.
  - Classes are interpreted per row (IG-07), e.g. Work = observed, Exam hall = formal + observed, Gym = public.
  - The "ALL public, formal, observed or caring" row limits Meditate to short, silent, eyes-open tools, and written Reflect to when no task is under way.
- **Tab 3a:** each flag excludes or prefers tools, or adds a prompt on the card (e.g. `card.prompt.noise_reduction`). Preferences rank in the trigger layer.
- **Tab 4:** urgency weights read as maximum 4, high 3, moderate 2, low 1 (IG-16).
  - Step caps: T0 at most 3, T1 at most 5, T2 none.
  - T0 shortens a needed reset to 2 minutes.
  - TX repairs first (Express, then the smallest step, no blame).
  - TR adds Routine. Its next-occurrence urgency needs an input that doesn't exist yet.
- **Tab 6:** each characteristic tags its driver. "Imposed", "Switching / transition" and "Stopping" are deferred by ADR 0004, so they are reference.
- **Tab 6b:** each need proposes its route, gated by the lights it lists. Need rows run at orchestration (Tab 8 step 10) because they need the final light.
- **Format 3 additions:** `drivers.add` takes an optional weight; new effect `minutes.cap`.
- **Revert:** n/a (method); each row is editable.

### E-50 Tabs 2, 6c, 6d, 7 and the non-negotiables mapped: every rule row is mapped (M3)
- **Coverage:** all 354 rule rows have a status: 27 exact, 156 interpreted, 2 unresolved, 169 reference, none pending. Each row's reason is in the mapping file (`packages/engine-v2/src/mapping/`) and in the dashboard.
- **Tab 2 (experience triggers):**
  - Each row reads its own feeling's intensity, because Tab 8 step 3 rates each feeling separately. "Use the HIGHEST intensity" decides which feeling leads when several fire. That is ranking, done by the engine (M4), not a row.
  - A skipped intensity matches neither a "Mild or Moderate" row nor a "High" row (IG-04: it must not read as mild). Rows marked "Any" still fire.
  - A sensation in a feeling's group (E-19) fires that feeling's row, e.g. "Frozen" fires the shutdown row. EX-1 now counts the shutdown sensations too, so it is `interpreted`.
  - "Demand deferred" reads as Red reads it: no task step, no "try anyway", "skip to task" or "start small", and no drivers. "Reduced to the minimum" means the task never leads; only its smallest step is queued.
  - "Co-primary" becomes a primary plus the first alternative, in the order written: the card has one primary.
  - "Immediate risk language" and "Not sure" are reference: SF-1 and NS-1 already run them.
- **Layers** (ADR 0004 §2):
  - **Guard:** shutdown, sensory overload, rumination, MD-2, and patterns 16, 19 and 40.
  - **Offer:** the v3.2 Reflect and Meditate rows, patterns 32 to 39, RF-1, MD-1, MD-4 and the Tab 6c setting rows.
  - **Task due:** pattern 15.
  - **New lowest layer, `default`:** the band patterns (1 to 8, 14, 27, 30, 31). They propose the band's card only when nothing above proposes, so a feeling still picks the action within what the band allows. ADR 0004's order is unchanged.
- **"Asked for":** a Reflect or Meditate feeling or need, or a practice that is due. "Remind me later" and "find a space" only show then. A test keeps these lists in step with the rows that offer Reflect or Meditate. It caught "Start or end my day well", which offers the end-of-day close.
- **Tab 6c:**
  - **RF-1:** no Reflect in Amber or Red, or with a harder feeling at High+. Amber shows "remind me later" where Reflect was asked for.
  - **RF-2:** no Reflect with rumination, or after a worse re-check of a Reflect card. The per-topic block stays deferred.
  - **MD-1 (c), (d):** Amber with a harder feeling at Moderate+ leads with Regulate, and the 3-minute settle or the user's own practice is offered as an alternative. In Red, Meditate is never the primary.
  - **MD-2:** a guard. Eyes-open only, no body scan, and the saved prayer audio only when the user starts it.
  - **MD-4 and section D:** each setting limits how a practice runs.
  - **Body scan:** offered only to users who opted in (the Meditate definition row).
  - RF-3 to RF-5, MD-3, MD-5 and MD-6 are reference: they describe tool, records or notification behaviour, or are structural.
- **Tab 6d:**
  - **Tiers:** the section A rows mark tools as Advanced or safety floor as rules (`tools.tier`, E-49). There are 44 Advanced tools, 17 floor tools and 18 other free tools. Every pathway except Reflect has a floor.
  - **ENT-1 and ENT-3:** read as rules for users whose plan lacks Advanced (the upselling rule). Such a user never gets an Advanced primary. Under strain, or after dismissing one, they see no Advanced tool; otherwise at most one.
  - **Amber and Red, on every plan:** the primary is a floor tool, and no Advanced tool is shown.
  - Plans, features and ENT-2 and ENT-4 to ENT-9 are reference (billing, records, workflow, or structural).
- **Tab 7 patterns:**
  - Each pattern proposes the same targets as the Tab 2 row it refines, with its CTA and alternative wording keys (`card.p<n>.cta`, `card.p<n>.alt.*`).
  - **Conditions with no input yet stay out:** "safety-critical" (18), "persistent" pain (24), "end of a demanding day" (33) and the same-topic count (40). Each is recorded in the pattern's reason.
  - **Pattern 13** needs two or more flags (ADR 0004 defers one flag).
  - **Pattern 30** stops all suggestions. A step forced by a higher layer (distress, safety) still shows.
  - **Pattern 28** is SF-1; its support-screen copy needs clinical sign-off.
  - **Pattern 41** is MD-2.
- **Non-negotiables:**
  - "Don't repeat a rejected suggestion" means the pathway just declined isn't the next primary (`signals.rejected`).
  - The others are structural or are mapped elsewhere. A test checks that no rule ever requires Reflect or Meditate.
- **Unresolved (2), founder decides:** "Recurring struggle" (the Tab 2 row and pattern 34). Both need a history signal from the check-in records (M5, IG-21).
  - **New:** on import, each unresolved row opens an `unrepresentable` gap in the gap register, for its decider. A re-import doesn't open a second gap while the first is still open.
- **Format 3 additions** (M3 is still open and no format 3 rule set has left the dev database):
  - **Effects:** `practice.limit` (modes, minutes, optional tools); `tools.tier`, `tier.limit` and `tier.require`; `reminder.offer`.
  - **Actions:** `open_home` and `check_in`.
  - **Layer:** `default`.
  - **Value lists:** `practice_mode` (eyes open, silent, headphones, short chips) and `tier`.
  - **Facts:** `recheck.previous_pathway`, `prefs.meditation_worse`, `prefs.body_scan_opt_in`, `signals.advanced_dismissed`, `signals.in_session` and `signals.rejected`.
  - **Stage-order check:** facts set by rules (band, light, setting classes, drivers) are marked `derived`. The validator refuses a rule that reads one before the stage that sets it.
- **For the engine (M4), decided here so the mapping means one thing:**
  - Equal proposals (same target, same slot) merge into one. The wording comes from the highest-ranked proposal that has wording.
  - The `queued` slot is an ordered list.
  - Forbidding a pathway forbids its tools.
  - Within a stage, rows run in tab, then row order (Tab 6d section A before the ENT rows).
  - When two requirements conflict, the one from the higher layer wins.
  - The 95 wording keys (`copyKeysOf()`) need their text.
- **Interpretations for the founder to confirm** (T-20): the ENT-3 upselling reading; skipped intensity matching no band row; anger without a communication need giving no route; the rumination guard leaving out the user's own practice; "anything needing silence" read as the stillness timer; "in bed: not first thing" read as never the primary; the lab counted as a formal setting; "Leave early" read as Step out.
- **Revert:** n/a (method); each row's mapping is editable.

### E-51 The engine (M4): how a check-in becomes a card, and the checks before publish
- **Where:** `packages/engine-v2/src/engine/`, pure with no dependencies. `compile(rows, catalogue)` puts a version's rows in run order; `run(compiled, input, { trace })` gives the card and the trace; `publishChecks(compiled)` checks the fixed rules. Engine version 2.0.0; it runs format 3.
- **Input:** the input facts by name, in standard values only, checked against the registry and the version's catalogue.
  - A fact the rules set (`derived`) or the engine works out (`computed`) is refused if sent.
  - A boolean left out is false; a set left out is empty; an unrated feeling is present with no rating.
- **Facts the engine works out:**
  - the State Grid cell, from energy and mood;
  - the families felt;
  - the number of sensitivity flags;
  - `peak.negative`: the highest rating among the *harder* families. Which families are harder is now catalogue data (the family's group, `interpreted`, E-48's CX-1 list), and CX-1 reads `peak.negative`, so the list exists once.
- **Run order:** stage (Tab 8), then "wave" (within a stage, rules that set a derived fact run before rules that read it), then the workbook's tab and row order. `compile` reports any rule order that can't be settled.
- **The band and the light:**
  - The band is settled when read: the baseline, minus the drops, then the drop limit (CAP-1), the floor (E4M1) and the rise limit (RC-3, RC-4). So the order the Tab 10 modifiers fire in doesn't matter.
  - Blue is an overlay (`light.overlay`, new) shown over the band's light, unless `light.never` says no (RC-5).
- **The card:**
  - **Requirements always beat proposals.**
  - **When a "must" and a "forbid" clash,** the one from the higher layer wins; a row with no layer ranks last. So a forced reset still shows after "Not now" or pattern 30.
  - **Proposals rank** by layer, then by how strongly the feeling behind them is felt (Tab 2's "use the HIGHEST intensity"), then by workbook order. A need has no rating, so it ranks below a rated feeling in the same layer.
  - **Equal proposals merge,** keeping the first wording in rank order.
  - **A primary that lost to a better one is offered as an alternative.**
  - **The queue** (the plan after the primary) is filled before the alternatives.
  - **At most two alternatives.**
  - **A pathway becomes its best allowed tool:** preferred tools first, then catalogue order. Never an excluded or forbidden tool, one already on the card, or one outside the slot's tier or over a tier limit.
  - **A required pathway takes the best proposal within it,** e.g. a forced Regulate shows pattern 16's tap-only Breathe and its wording.
  - **Wording (`copy.use`) applies** to the item its own row put on the card.
  - **"Get support now" comes first** among the visible buttons.
- **The safety override** stops the run after the safety stage; the card is the support screen only.
- **Trace:** `light` lists the rules that fired; `full` adds every rule checked (and where its condition failed), the facts after each stage, and what happened to each proposal (used, merged, blocked by, outranked, no tool, over the limit). The card names the input the primary's rule matched ("Because you said X").
- **Checks before publish** (DESIGN §5):
  - **The sweep:** 3,468 inputs covering every cell and "not given", each feeling at High, no task or T0 or T3, and free or Plus, with places and flags rotated through.
  - **The 8 fixed rules:**
    - Red shows support;
    - support is never hidden;
    - the primary is in the user's plan;
    - nothing Advanced in Amber or Red;
    - one primary and at most two alternatives;
    - no task first in Amber or Red;
    - the Hopeless chip shows the support screen;
    - no Reflect in Amber or Red.
  - The v3.3 rule set breaks none of them; the sweep takes about 2 seconds.
  - **On submit:** each broken rule is recorded as a gap (decided by Clinical Safety for the safety ones), naming the rows responsible.
  - **On publish:** a broken rule blocks until its gap is acknowledged, like an exempt safety row (E-21). So a deliberate, signed-off exemption such as SF-1 can still ship, and an accidental break can't.
- **Mapping bugs the engine exposed, fixed:**
  - **The Tab 1 "regulate first" rows (E-48) never checked their cell,** so they fired for every cell. Each now checks its own cell.
  - **RC-1, RC-3, RC-4 and RC-5 ran at the feedback stage,** after the light and the card. They now run at capacity fit. A new format check refuses any rule that changes the band, the light or the setting classes after the stage that settles them.
  - **Red with a task:** the task is off the card, except at T0, where only its smallest step is queued (ADR 0004 §3). Before, the step could come back as an alternative.
  - **Amber:** Urgency is kept only at T0/T1 (ADR 0004 §9).
  - **Amber and Red with a task but no strong feeling had no primary.** The Amber and Red band rows now propose a reset as their default card (in the new lowest `default` layer), with "Start small" in Amber (ADR 0004 §4).
  - **Yellow:** Tab 10's "light or optional intervention" is a reset offered as an alternative.
  - **Patterns 1 and 2** read "no distress trigger" as no harder feeling at High+, so mild anxiety in Green stays an alternative to the task (ADR 0004).
  - **Pattern 15:** in Amber and Red, the T0 smallest step is queued, not proposed as the primary.
- **To review (T-20):**
  - losing primaries offered as alternatives;
  - needs ranking below rated feelings;
  - a Blue card with no task, or a Yellow one with nothing to do, has no primary, only options.
- **Revert:** n/a (new engine); the band-row and pattern changes are rule edits.

### E-52 Engine v2 decisions: the API, the records, replay and the staff tools (M5)
- **Routes** (E-27 left them to M5):
  - `POST /v1/decisions`: a check-in (the app's v2 contract, E-39) becomes a card, signed in or Browse (`X-Browse-Token`). The response carries the card, the version label and hash, and the engine version.
  - `GET /v1/decisions/{id}`: the user it was made for sees the card; staff also see the input facts, the full trace and the last replay.
  - `POST /v1/decisions/{id}/replay`: staff.
  - `POST /v1/rulesets/{label}/simulate`: staff; input facts in, card and trace out, nothing stored (the Simulator, E-18).
  - `POST /v1/rulesets/{label}/explore`: staff; many inputs, or the publish sweep. Returns cards by light and by primary, plus the fixed-rule checks.
  - **Why "decisions":** a decision is the record of one card the engine made, and `/v1/recommendations` is v1's.
- **From check-in to input** (`factsFromCheckIn`, in the package):
  - Each answer goes through its option's "Maps to" (E-40).
  - Who's around, time, body regions and task kind carry no fact yet (IG-06, IG-08, IG-09, IG-14).
  - Several chips of one family keep the strongest rating.
  - The Not-sure path counts only a confirmed cell.
  - "Just support" leaves the task out.
  - Task characteristics are the codes the app sends that are catalogue values, plus "putting it off" as a long-avoided task (IG-17).
- **Server facts:**
  - The v1 signal loader's answers become `signals.*` and `prefs.*`: plan, declines, recent safety event, in session, dismissed Advanced, recovery window, practice due, the meditation settings, and rejected tools as their pathways.
  - SF-2's days in a row at Red are counted from the user's own decision records.
  - The re-check reads the earlier decision of the same user: its light, band, primary pathway and harder-feelings peak.
  - "Band improved" and "intensity change" are now worked out by the engine, from the new baseline and `recheck.previous_peak`.
  - Browse gets the free plan and the UK time zone.
- **Records** (`decision_records`, DESIGN §7). Each holds:
  - the input facts (standard values only, E-13);
  - the version and its hash, and the engine version;
  - the card and the full trace;
  - band, light, support screen, and what it re-checks.
- **Rules for records:**
  - Browse records carry no account (E-05).
  - **Append-only:** a database trigger refuses any change except the replay outcome, or clearing the account link.
  - **Account deletion:** the records stay, unlinked like a Browse record (as safety events already are). O-06 decides retention.
- **Replay:**
  - It re-runs a record on its own version and compares the card and trace as canonical JSON (RFC 8785). Postgres reorders JSON keys, so comparing the stored text would report false differences; the test caught this.
  - A new engine version is reported as a mismatch, never hidden.
  - **Daily job** (`decisions.replay-sample`, 04:50 UK time): the newest 50 records of the last day; any difference is logged as an error for alerting.
- **Runtime:** a published or retired version is compiled once and kept, and the published one is re-looked-up every 30 s. Drafts and versions in review compile on each call, so the Simulator can be used on work in progress.
- **Known gaps (recorded, not filled):**
  - **"Support completed" (RC-1) needs v2 cards to open session records (M8).** Until then RC-1's Blue can't show on a v2 re-check.
  - **"I'm grateful" maps to the gratitude family with no rating,** so the gratitude rows (Mild/Moderate) don't fire for it (IG-04).
  - **Only the running engine can replay.** Keeping older engine releases runnable (DESIGN §7) is T-24.
- **Revert:** drop the module and the migration; nothing else depends on it until the app moves to v2 (M8).

### E-53 The app's check-in runs on engine v2; the card's wording is rule-set data (M8, server side)
- **The switch:** once a v2 rule set with check-in options is published, `POST /v1/check-ins` makes its card with engine v2. Signed in, Browse and re-checks alike.
  - **Signed in:** the decision record and the recommendation row that sessions, actions and re-checks hang off are written in the check-in's transaction.
  - **Browse:** the decision is recorded without an account (E-05).
  - **v1** still runs when no such version is published (the transition; T-17).
- **The app's card contract is unchanged.** A presenter fills it from the v2 card, so the Figma-matched card screen, links and sessions keep working, and the OpenAPI file doesn't change.
  - The always-visible buttons ("I'll try the task anyway", "Skip to task") take the two alternative places first.
  - A card with no primary offers its first option as the primary, never one from a pathway the user just declined, or else Home.
  - Prompts (e.g. headphones) become a sentence after the rationale.
  - The stored card re-renders exactly. "Why" is kept with it.
  - "Try another" re-runs the stored input with the declined pathway as just rejected.
- **Wording:** a new added table, `x-copy.csv` (Key, Text, Source, Note), seeded on import. It holds 234 keys: every key a rule uses has text, and every CTA has a headline (tested).
  - **Tab 7 patterns:** the headline (`.title`) and button (`.cta`) are taken word for word from each pattern's CTA cell, and options from its alternatives cell. Where a cell gives only a headline, the button label is `interpreted`, with a note.
  - **Fixed buttons:** "Get support now", "Start small" and the rest, from the patterns that name them.
  - **The rationale** is the workbook's "Because you said X, … suggests Y.", with the app's name, FigCit, and the user's own chip words with a strength word (E-47).
  - **Tool labels:** Tab 6d's names, shortened.
  - **Unconfirmed state:** "Not sure yet", the app's existing wording.
  - The state names, light labels and colours still come from the app's existing content (T-25).
- **Safety:** free text never reaches the engine. The server's phrase screen (ADR 0004 §7) reads the texts v1 read and gives the engine `safety.risk`. The safety event records whether a phrase (with the rule and category) or the Hopeless chip triggered it.
- **Rule fixes the switch exposed:**
  - **RC-1's "better cell" compared the new baseline with the previous *final* band,** so a re-check with the same cell and feeling counted as improved when the first card had been lowered by EX-1. It now compares baseline with baseline (`recheck.previous_baseline`, from the earlier decision's trace).
  - **The recurring struggle (Tab 2 and pattern 34) is mapped,** no longer unresolved. The check-in records already give the signal: the same feeling, setting or task 3+ times in 14 days, confirmed by the user (`signals.recurring_struggle`). The workbook now has no unresolved row.
  - **Grief offers the user's own practice** only when they have one marked as helping when struggling (`signals.practice_helps`), and then before Adapt.
  - **Pattern 27:** [Quick body check] is the primary (the Not-sure flow).
  - **Pattern 20:** the button is the 5-minute break, so the break leads and the stop point follows. A card's label must match the tool it opens (ADR 0004).
  - **CTA wording** comes from the patterns, not from Tab 2 rows (Tab 2 routes, Tab 7 words).
- **Engine fix:** the full trace lists only facts that have a value, never defaults. Before, adding a fact changed every older trace, and replay reported records as changed when nothing about them had (found by the daily replay).
- **Re-check:** "support completed" now comes from the re-checked card's session (closing T-23 for check-ins). The re-check rule that applied is reported to the session's feedback, as v1 did, so recovery windows open.
- **Browse card actions:** `POST /v1/decisions/{id}/another` re-runs a Browse decision with the declined pathway just rejected and returns the app's card, recorded without an account. Browse cards are decisions, so the app no longer needs an engine of its own for "try another" or Adapt (E-01).
- **Revert:** unpublish v2 (publish a v1-era version) and the check-in falls back to v1; the code paths stay.

### E-54 The staff app (M6): one app in the client repo for rules and operations
- **Built:** `figcit-pwa/apps/staff` (package `@figcit/staff`). A Next.js static export in its own pnpm workspace, never bundled with the user app (E-31).
  - **Stack:** the user app's stack and versions (React Query, openapi-fetch, zustand, Tailwind). No new dependency.
  - **Contract:** types generated from this repo's OpenAPI file. It doesn't import `@figcit/engine-v2` (E-31).
- **Sign-in:**
  - Password, or a staff sign-in link (`app: 'staff'`, which opens `STAFF_APP_URL`).
  - The access token is held in memory. The refresh cookie is `SameSite=Lax`, so the app is served on the API's site, as the user app is.
  - Every page needs a staff role and a two-step session. Menus follow roles; the API checks both on every request.
- **Rules section (engine v2):**
  - Versions: import, draft, submit, publish, roll back, discard, export.
  - Tabs in workbook order, with filters. Each row shows its words, its engine columns with the interpretation, and its history across versions.
  - The row editor for the clinical admin (E-12, E-34): words, mapping, safety mark and engine columns; retire, restore, and add a row after.
  - The Simulator (E-18): editors are built from the format endpoint, and the trace is shown stage by stage with each proposal's fate.
  - The Explorer (E-56), gaps and owner decisions, and the rule audit log with its chain check.
- **Operations section:** the old `/admin` screens, redesigned (E-33).
  - Overview, and decision records (filters, card, input, trace, replay; v1 recommendations kept read-only until T-17).
  - Safety events, content versions, and the v1 content snapshot (still the app's presentation content, T-25).
  - Staff roles: an admin can't untick their own admin role.
  - The platform audit log.
  - Research export, shown as not connected (no ethics approval or store yet).
- **Styling:** the user app's tokens, light and dark, copied until the shared token package (E-31). The layout is a denser desktop one, responsive on mobile. Every string is in `src/messages/en/`.
- **Checks:** typecheck, unit tests (session claims, the HTTP problem, input parsing, and that every menu entry has a page gated to the same roles) and the build. All run in the client repo's `pnpm check`.
- **Revert:** delete `apps/staff` and restore the PWA's `/admin` (E-55).

### E-55 The user app's `/admin` is retired (T-05)
- **Decision:** the staff app covers every `/admin` screen, so the user app no longer has a staff console.
- **Built:**
  - Staff who sign in to the user app start at Home like anyone else.
  - "Staff app" on Me opens `NEXT_PUBLIC_STAFF_APP_URL` (shown only when it's set, and now also for `clinical_admin`).
  - Configuration: `apps/staff/README.md`. The API's `CORS_ORIGINS` must list the staff app's origin.
- **Why:** E-31, E-33. Two consoles would drift.
- **Revert:** restore `src/features/admin` and the routes from git.

### E-56 The explorer, query and impact (M7)
- **All-flows set** (`flowInputs`, DESIGN §8), built from the version itself:
  - **The sweep:** the publish sweep.
  - **A pairwise cover:** every input fact at each value the rules tell apart. For numbers and intensities, those are each threshold a rule compares with, the value below it, and the intensity band edges (3/4, 6/7, 8/9). Keyed facts get two keys, so rules that read two feelings at once (one of them high) are reached.
  - **A seeded random sample:** 2,000 inputs by default. A core fact (state, feeling) is given 9 times in 10, any other 1 time in 3.
  - A fact that needs another gets it (a timeline → a task; any re-check fact → a re-check).
  - **On v3.3:** about 6,700 inputs in about 3 s. Every one of the 289 rules fires at least once; the sweep alone leaves 106 unfired. No fixed rule breaks.
- **Safety set** (`safetyInputs`, E-21): every combination of the input facts the rows marked `safety` read.
  - A computed fact counts as the inputs it is worked out from. A derived fact counts as the state, feelings and setting.
  - A keyed fact is rated for one key at a time.
  - **On v3.3's SF rows:** family, risk and the two day counts give 25,500 combinations (19,875 distinct) in about 3 s. No fixed rule breaks.
  - **Over the cap (30,000):** a pairwise set over the same values instead, reported as not exhaustive.
- **Explorer report:**
  - The **outcome map**: state × strongest feeling → the most common light and primary, and how many different outcomes the pair gave.
  - **Cards with nothing to offer:** no primary, no alternatives, not a support screen.
  - **The query:** inputs by light, by primary, or by a row that fired. Rows are named by tab and reference.
  - **Rules never fired**, and the fixed-rule checks.
- **What one rule affects:** `POST /v1/rulesets/{label}/impact` runs the same inputs with and without the row, and reports how many inputs it fired on and which cards change.
- **Compare:** compare (a version's impact against another) takes the same sets.
- **Decisions by version and day:** `GET /v1/decisions?ruleset=…&since=…` ("which decisions in October used 3.3-r2").
- ~~**Deviation from DESIGN §8:** the explorer runs in the request, not in the job queue.~~ Withdrawn by E-57: holding 15 s of CPU on the API's event loop breaks ENGINEERING_RULES §6. The explorer runs in the worker, as DESIGN §8 says.
- **Contract fix:** simulate, explore, compare, impact and replay return 200 (they create nothing), as the OpenAPI file already said. Nest had sent 201.
- **Found by the explorer** (for the Owner, `TODO.md` T-28):
  - Red, with Regulate just declined, gives a card with only "Get support now".
  - Non-negotiable note 3 blocks re-offering the declined pathway, and Red proposes nothing else, so the app falls back to Home. Whether Red should offer something else (rest, Connect) is a rule question.
  - Also found: a generator bug. A "not rated" level (`null`) was turned into 8, so unrated feelings were never tested. Fixed and tested.

### E-57 Finishing (M9): records within budget, the explorer in the worker, exceptions in an ADR
- **Decision records keep the light trace** (the rules that fired and the run's notes). The full trace is rebuilt by replaying the record on its own version when staff open it, and the response says `traceFrom: replay`.
  - If the rebuilt run fires other rules than recorded (an engine change, T-24), only the stored light trace is shown (`traceFrom: record`).
  - A re-check rebuilds the earlier decision's `peak.negative` and `band.baseline` the same way.
  - Replay compares the card and the rules that fired. Records stored with a full trace (development data from before this change) still compare.
- **Why:** E-52 had stored the full trace. That contradicted E-21 ("the trace is rebuilt by replay") and E-23, and broke ENGINEERING_RULES §1.3. Measured: about 52 KB of text, 12.8 KB on disk, against a budget of 4 KB per recommendation.
  - Now a record is under 4 KB, tested in `decisions.e2e`.
- **The explorer runs in the worker** (DESIGN §8; ENGINEERING_RULES §6), withdrawing E-56's in-request deviation.
  - `POST /v1/rulesets/{label}/explore|compare|impact` checks the request at once (versions, rule, input set). It then stores the run in `engine_explorations`, queues `rulesets.explore` and returns `202` with the run.
  - The worker runs it and stores the result. Staff poll `GET /v1/rulesets/explorations/{id}`; the staff app polls every second.
  - A lost queue message is run by the worker's minute sweep. Results are deleted after 7 days (`retention.nightly`).
  - A request the engine can't serve fails without a retry, with the reason stored.
  - The Simulator (one run) stays in the request.
  - Migration `20261102010000_engine_explorations`, since squashed with the branch's others (E-58).
- **Tests added:**
  - Every condition operator on every kind of fact (`conditions.test.ts`), including those the workbook doesn't use yet.
  - The engine properties of ENGINEERING_RULES §13 over 3,000 seeded random inputs (`properties.test.ts`).
  - The §1.1 budget over the all-flows set (`budget.test.ts`): p50 0.31, p95 0.97, p99 3.9 ms.
  - Engine-v2 coverage: 97.9% lines, 90.2% branches.
- **Exceptions to the engineering rules** are in ADR 0005 (E-23 asked for an ADR before merge): example tabs not run; JSONB for rule rows, frames and explorer runs; properties without fast-check; coverage at 95/90 rather than 100.

### E-58 The branch's migrations are one migration (E-34)
- **Done:** the six working migrations are squashed, in order and as written, into `20261102030000_engine_v2`: the rule store, `clinical_admin`, the reference mapping, the check-in's standard input, decision records and explorer runs. The repo rule is one migration per PR.
- **Checked:**
  - On an empty database it applies after `main`'s two migrations, and `prisma migrate diff` against the schema is empty.
  - Every trigger is there: append-only records and audit, frozen versions, draft-only rows.
  - The e2e suite passes on a test database built from it (111 tests).
- **A database that applied the old six** (the development database here, which the test server also uses, is done) needs one step. Its tables are already right, only its migration history differs:
  - `DELETE FROM _prisma_migrations WHERE migration_name IN ('20261101113000_ruleset_store', '20261101120000_clinical_admin_role', '20261101130000_rule_mapping_reference', '20261101140000_checkin_standard_input', '20261101222219_decision_records', '20261102010000_engine_explorations');`
  - then `prisma migrate resolve --applied 20261102030000_engine_v2`.
  - A test database can simply be dropped; the e2e setup recreates it.
- **If `main` gains migrations before the merge:** regenerate this one after rebasing, as the repo rule says.

### E-59 One engine, on the server: the app's copy is removed (T-04)
- **Decision (Owner, 2 Nov 2026):** the engine runs only on the server, Browse included. The app keeps no copy of it, for offline use or anything else, as agreed earlier (E-01).
- **Built:**
  - **The typed-text safety check:** the app used the vendored engine to screen dumps and reflections kept on the phone in Browse.
    - Now `POST /v1/safety/screen` (Browse token or signed in) screens them with the server's phrase rules. It returns whether a phrase matched and its category. The text isn't stored; a match records a safety event (rule and category).
    - Signed in, each module's own API call already screens the text.
    - **Offline, nothing screens typed text.** The Help pill is on every screen (PWA hard rule), so help stays one tap away.
  - **Browse task order:** `POST /v1/tasks/order` orders the tasks kept on the phone. It takes only what ordering reads (timeline, drivers, steps left, putting off, skips, plan slot) and refuses a title. Offline, the app shows the tasks in their saved order with no "why now".
  - **Types:** the app's few engine types (light, timeline code, the content snapshot's fields) are its own (`src/lib/content/types.ts`), until the content moves into the rule set (T-25).
  - **Removed:** `vendor/engine`, `scripts/sync-engine.mjs`, the `@figcit/engine` paths and aliases, and the webpack setting they needed.
  - **The size check is inverted:** a build that carries engine code now fails.
  - The PWA's README and AGENTS.md say the server runs the only engine. The PWA's SYSTEM_DESIGN still describes the device engine. It is left for its owners, since agents don't edit it unasked.
- **Why:** two engines drift. The safety screen in particular must be one set of rules.
- **Revert:** restore `vendor/engine` from git and point the two callers back at it.

### E-60 Red keeps a choice after a decline; Amber's forced primary holds without a task (T-28)
- **Found by the explorer (E-56):**
  1. Red, with Regulate just declined, left a card with only "Get support now".
  2. Amber, with the need "Get started" and no task, put Execute (the smallest step) first.
- **What the shared documents say:**
  - **Workbook, Tab 7 patterns 6-8:** Very Constrained gives "Regulate and/or Dump and/or Connect", "Regulate/Dump forced immediately" (pattern 7), and "Regulate/Dump/Connect + Support pathway visible" (pattern 8).
  - **Workbook, non-negotiable note 3:** only "do not repeat the same rejected suggestion immediately".
  - **Workbook, pattern 30:** stops suggesting after 3 declines in a session.
  - **PRD v3.1 FR-M04-07 and US-M04 acceptance:** "Not now and Try another are always available. In Red, 'Get support now' is shown on the card".
  - **PRD v3.1 §15.1:** a rejected recommendation leads to "Not now, Try another, change state, or open any module manually".
  - **Activity Tables v2.1, process 8:** the customer "starts it or picks another".
  - **Tab 1 Amber:** "Intervention is the forced primary", which the fixed publish check "no task first in Amber or Red" also states, with or without a task.
- **Decision:**
  - **Red:** the Very Constrained band row offers Red's three pathways in the workbook's order: Regulate, then Dump, then Connect. A declined one gives way to the next, and the others are the alternatives. "Get support now" stays visible on every Red card. Pattern 7 also has Dump beside the reset, as its sequence says. A feeling that leads to Dump or Connect still picks first (E-51). After 3 declines, pattern 30's "stay out of your way" card applies as before.
  - **Amber:** Execute is never the primary, task or not. The Amber band row's forbid no longer needs a task. "Try anyway" and "Start small" still come only with a task.
- **Tests:** a Red card after one, two or three declines (with and without a task, at T0 and T3) always offers something and keeps "Get support now". The Amber "Get started" case keeps Execute off the primary. The all-flows set over three seeds has no card with nothing to offer and no fixed rule broken.
- **Mapping status:** both band rows stay `interpreted`. Clinical Safety confirms the Red order with the other safety rows (T-11).

### E-61 The Simulator runs a check-in, screen by screen (Owner, 2-3 Nov 2026)
- **Why:** the first Simulator (E-18) took engine facts typed by hand. DESIGN §8 asked for inputs "in the order of the check-in". The Owner and the clinical admin need to see each step: what each screen adds, what the server adds, what the engine reads, the run and the card the user sees.
- **Decision (Owner):**
  - **One Simulator page.** It shows the check-in screens in the app's order, with plain controls. Full, Quick (starts at Need) and Re-check change which screens appear. Each screen shows what it adds to the check-in, what the engine reads from it, and what it leaves out and why.
  - **The result, in the order a check-in goes:**
    1. The check-in as the app sends it.
    2. The engine input, each fact with where it came from.
    3. The engine run.
    4. The card as the app receives it.
  - **Who:** Browse, or signed in on Free, Plus or Institution. A signed-in user starts with a new user's history. A collapsed "Account history" panel changes the signals. It is not a simulation of users.
  - **Edited by hand:** the engine input can be edited as JSON for testing one rule. The result is then marked as an input the app can't send. The old fact-only form is removed.
  - **The AI steps** (parse-need on the Need screen, suggest-drivers on the Task screen):
    - picked by hand by default;
    - "Run the real AI", turned off while the model isn't ready (not configured, or its circuit is open);
    - "What the app gets now", the model or its rule-based fallback, labelled as such.
  - **Replay:** "Try another" declines the main suggestion's tool, as the app's rerun does. "Re-check" checks in again about the card shown, with "They finished what was offered". Each step is listed.
  - **Saved scenarios:** a scenario keeps the answers and what it runs. Scenarios are shared by the staff who use the Simulator. Each run keeps the version, who ran it and the card it gave. A run that gives a different card from the run before is marked. Saving and deleting go on the rules audit chain, and deleting needs a reason.
- **The same code as a real check-in:**
  - `factsFromCheckIn` now folds `explainCheckIn`, so the explanation and the engine input can't differ.
  - The Simulator route runs the check-in's own steps on any version, drafts included: the options check, the risk check on the four texts, `factsFromCheckIn`, the engine and the presenter. A test checks that its engine input equals what a real new user's check-in records.
  - Nothing is stored. A risk match makes no safety event, and the AI steps count against no user's limit.
- **Routes (staff):**
  - `GET /v1/rulesets/{label}/check-in-options`
  - `POST /v1/rulesets/{label}/simulate-check-in`
  - `GET /v1/ai/status`
  - `POST /v1/ai/try/parse-need` and `POST /v1/ai/try/suggest-drivers`
  - `GET|POST /v1/rulesets/scenarios`, `GET|DELETE /v1/rulesets/scenarios/{id}` and `POST /v1/rulesets/scenarios/{id}/run`
  - Migration `20261103000000_sim_scenarios`.
- **Found while building it:**
  - The card's "After that: …" lowercased the next step's first letter, which broke "AI body double". Acronyms and the word "I" now keep their case.
  - After "Try another", the card says "Because of how your energy and mood are right now…" even when the user named feelings: the rerun passes no feelings to the presenter. The Simulator shows this as the app does. T-31 records it.
  - The AI's task characteristics are v1 codes (`first_time`, `multi_step`…) that the v2 catalogue doesn't have, so no AI-suggested characteristic ever reaches the engine. T-16 now records this.

## Dropped or changed from earlier proposals (one list)

| Idea | By | Status | Reason | Where recorded |
|---|---|---|---|---|
| First milestone limited to a slice | Claude, 1 Nov | Dropped | E-08 | E-08 |
| Drift as a publish gate | Claude, 1 Nov | Dropped | E-10 | E-10 |
| Running the example tables against each version | ADR 0004 §1 | Dropped | E-10 | E-10, ADR 0004 |
| Spreadsheet as master until the editor exists | Claude, 1 Nov | Dropped | E-12 | E-12 |
| Editor built last | `DESIGN.md` §12 | Dropped | E-12 | E-12 |
| Phrase check on the phone | Claude, 1 Nov | Dropped (out of scope) | E-14 | E-14 |
| Encryption of v2 records in this stage | `DESIGN.md` §7 | Deferred to before launch | E-13 | E-13, O-15 |
| Shadow run on live check-ins; v1-against-v2 comparison as the merge test | Claude, 1 Nov | Dropped | E-18 | E-18 |
| Editor role, Product Owner approval, Clinical Safety co-approval, no self-approval | `OWNER_DISCUSSION.md` O-07 | Deferred (one clinical admin for now) | E-20 | E-20, `TODO.md` |
| Waiting for the founder's input-gap session before building | `DESIGN.md` §12 step 1 | Dropped | E-19 | E-19 |
| `/v2/...` API paths | `DESIGN.md` §10 | Changed to `/v1/rulesets/...` | E-27 | E-27 |
| Storing only changed rows per version | Claude, 1 Nov | Dropped | E-26 | E-26 |
| Staff app at `figcit-backend/apps/admin`, rule screens only | E-15 | Replaced: one staff app in the client repo | E-31 | E-31 |
| Rule changes by the general `admin` role | E-20 | Replaced: `clinical_admin` | E-34 | E-34 |
| Client work only after the backend M2-M5 | E-32 | Changed: the check-in input is fixed now | E-39 | E-39 |
| Optional task toggles when AI is off | Claude, 1 Nov | Dropped | E-44 | E-44 |
| Explorer in the request (not the job queue) | Claude, E-56 | Withdrawn: runs in the worker | ENGINEERING_RULES §6 | E-57 |
| v1's invented feeling chips and places | v1 build (B-07, B-10) | Dropped | E-40 | E-40 |

## Open points that came out of this conversation

All are in `OWNER_DISCUSSION.md` with sources, constraints, options and a recommendation:

- O-11 Safety rules without clinical sign-off
- O-12 SF-2 against "we do not monitor check-ins in real time"
- O-13 Support without a check-in (D-39)
- O-14 Product decisions the engine rests on (provisional)
- O-15 Decision records: replay, hashing, encryption, Browse and deletion
- O-16 What the public API returns (trace, export)
- O-17 Where data ends and code begins
- O-18 What the engine does while a rule is exempt
