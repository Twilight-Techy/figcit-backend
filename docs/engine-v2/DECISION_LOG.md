# Engine v2: decision log

- **Status:** Living record. Every decision, every dropped idea and every deviation from Figma or the earlier docs on this branch goes here, with the reason and how to undo it.
- **Branch:** `engine-v2/rules-redesign`.
- **Decided by:** the Owner, in conversation, on 1 Nov 2026 (E-01 to E-07 are also in `DESIGN.md` §2).
- **Where this sits:** where this log and `DESIGN.md` disagree, this log wins. `DESIGN.md` is updated to match when a decision lands.
- **Related:** `DESIGN.md`, `INPUT_GAPS.md`, `OWNER_DISCUSSION.md` (points for the founder and Clinical Safety lead), `docs/adr/0001-engine-follows-workbook-rules.md`, `docs/build/DECISIONS.md` (the earlier build's `B-xx` entries) and `docs/CONFLICTS.md` (`D-xx`).

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
  - ADR 0001 §1's "run the examples against every version and record drift". ADR 0001 is amended to say so.
- **Open:** whether to keep the example tabs imported as read-only reference. `OWNER_DISCUSSION.md` O-05.
- **Touches:** `DESIGN.md` §1, §3.6, §6; ADR 0001 §1.
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
| §13 "Engine fixtures: every scenario row in Tabs 0, 0b, 6d, 9, 10 passes" | v2 is not tested against the example tabs | E-10 (Owner). ADR 0001 already says the examples are not tests. The v2 tests are written from the rules | No regression oracle from the examples | When the Owner wants them back |
| §5.3 "JSONB only for the trace, snapshot, card payloads and event properties" | Rule records keep the workbook's columns and the engine's columns as JSONB | The rule set is the snapshot, split into rows so rows can be edited one at a time (E-12). They are never filtered or joined on | None expected: the engine loads a whole version at once | If row-level queries are needed |
| §1.3 "one recommendation including trace < 4 KB" | Honoured by storing the input, the card and the versions, and rebuilding the trace by replay (E-21) | The v2 trace is larger than 4 KB | Replay must be exact (a daily check, `DESIGN.md` §7) | O-15 |

### E-24 Reader behaviour on the workbook
Recorded so a reviewer can see what the reader does with the spreadsheet (`packages/engine-v2/src/ruleset`).
- **Layout:** every tab is read as notes (one filled cell) and tables (two or more). A table's first row is its header (Tabs 0 and 0b: the row starting "Ref"). Blank rows and notes end a table.
- **Word for word:** every cell is stored exactly as written, with its column heading, its sheet row and its cell range. A test checks that no filled row is dropped and that every record matches its source row.
- **References:** the author's own ID is the reference (E1M1, T0, EX-1, RF-1, ENT-3). Tab 2 uses family plus intensity band. Tab 7's `16.0` is stored as `16` (listed in the import report). A repeated reference gets `#2` (listed in the report).
- **Examples and reference tables** (Tabs 0, 0b, 9, 6d section F, and the glossary tables under Tab 0) are stored with the role `example` or `reference`, read-only, never run.
- **Tab 7 footer** lines become the `non_negotiables` table. The first line is a heading; the rest are rules.
- **Not imported:** the workbook's "Sheet1" scratch tab (ADR 0001). It isn't in the CSV set.
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
- **Built:** `clinical_admin` added to the user roles (migration `20261101120000_clinical_admin_role`, `users.prisma`, `STAFF_ROLES`, the roles screen's allowed list).
- **Open:** a platform `admin` grants roles, so an admin could grant themselves `clinical_admin`. The grant is audited. Whether only the Owner may grant it is part of O-07 (`TODO.md` T-01).
- **Note for merge:** the branch now has two migrations; they are squashed into one before the PR (repo rule: one migration per PR).

### E-35 Where the staff app is hosted
- **Working assumption:** its own subdomain (e.g. `admin.<domain>`). Not decided; it doesn't affect the work until the staff app is deployed. Its own origin keeps staff sessions and cookies apart from the user app.

### E-36 The rule format is served by the API, per version
- **Decision:** `GET /v1/rulesets/{label}/format` returns everything a client needs to show, edit and check engine columns for that version: the stages (tied to Tab 8), the precedence layers (ADR 0001 §2), the card slots and actions, every fact with its type, domain and allowed operators, every effect with its parameters and class (requirement, proposal, modifier), the size limits, the catalogue's values per domain, and the JSON Schema (2020-12) of engine columns with those values filled in. The staff app builds its editor from this response, not from code.
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
- **What it is:** the Hopeless chip is a "selected option" under SF-1 and maps to the family "Immediate risk language", so the safety override fires at any intensity (ADR 0001 §7).
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

## Dropped or changed from earlier proposals (one list)

| Idea | By | Status | Reason | Where recorded |
|---|---|---|---|---|
| First milestone limited to a slice | Claude, 1 Nov | Dropped | E-08 | E-08 |
| Drift as a publish gate | Claude, 1 Nov | Dropped | E-10 | E-10 |
| Running the example tables against each version | ADR 0001 §1 | Dropped | E-10 | E-10, ADR 0001 |
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
