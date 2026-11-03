# Engine v2: points to discuss with the Owner

- **Purpose:** points to settle with the Owner and, where marked, the Clinical Safety lead. Each point says how we are approaching it now, what the sources actually require, the constraints, and a recommendation. Record the outcome on each point's **Decision** line.
- **Related:** `DESIGN.md`, `INPUT_GAPS.md`, `docs/adr/0007-engine-follows-workbook-rules.md`.

| ID | Topic | Who | Blocks |
|---|---|---|---|
| O-01 | Engine on the server only; what works offline | Owner | Confirming E-01/E-03 |
| O-02 | Recording Browse-mode recommendations | Owner, legal | Compliance trail for Browse users |
| O-03 | Who screens free text for risk language | Owner, Clinical Safety, free-text team | Safety override from typed text |
| O-04 | ADR 0007 interim safety rulings | Clinical Safety | Launch |
| O-05 | Reviewing drift from the example tables | Owner, Clinical Safety | Rule changes after import |
| O-06 | Clinical safety standard, medical-device status, keeping records | Owner, legal | Launch |
| O-07 | Who approves rule changes | Owner | Publishing |
| O-08 | AI help when mapping prose rules | Owner | Import speed |
| O-09 | The rule store or the spreadsheet: which is the master copy | Owner, workbook author | After the first import |
| O-10 | Input values that aren't standardised | Owner, Clinical Safety | Engine input contract |
| O-11 | Safety rules without clinical sign-off | Clinical Safety, Owner | Launch |
| O-12 | SF-2 against "we do not monitor check-ins in real time" | Clinical Safety, legal, Owner | Launch; SF-2 behaviour |
| O-13 | Support without a check-in (D-39) | Owner, Clinical Safety | Engine input contract |
| O-14 | Product decisions the engine rests on (provisional) | Owner | Confidence in current behaviour |
| O-15 | Decision records: replay, hashing, encryption, Browse and deletion | Owner, legal | Launch |
| O-16 | What the public API returns (trace, export) | Owner | API contract |
| O-17 | Where data ends and code begins | Owner, workbook author | Rule format |
| O-18 | What the engine does while a rule is exempt | Owner, Clinical Safety | Import and publish |
| O-20 | How Advanced (Plus) tools are offered on the card | Founder | Confirming E-62 |

Owner rulings of 1 Nov 2026 are filled in on O-01, O-03, O-05 and O-09 below, and listed in `DECISION_LOG.md`.

---

## O-01 Engine on the server only; what works offline

- **Current approach:** decided 1 Nov 2026 (DESIGN.md E-01, E-02, E-03). The engine runs only on the server, for users with and without an account. Offline, Help/SOS, crisis numbers, Breathe, Ground, core Sounds and saving a check-in still work. The card comes once the device is back online.
- **What the sources require:**
  - **Workbook:** says nothing about offline. Tab 1's note recommends keeping the recommendation logic "fully server-side" to protect it.
  - **PRD:**
    - Browse without an account is a Must (FR-M01-04).
    - The Free plan includes "the full engine" with or without an account.
    - Only core Regulate tools must work offline (US-M05-02.2).
  - **Activity Tables:** check-ins recorded offline are synced later.
  - **Figma S81:** the only source that shows offline recommendations ("Uses last known rules").
  - **Build:** the device engine came from the build agent's decisions B-28, B-29 and B-36, not from the specs.
- **Constraints:**
  - Someone offline in distress gets no card. Help/SOS and crisis numbers still work, because phone calls don't need the internet (Figma S81 says so).
  - The PWA must be changed: remove `vendor/engine` and change S81's wording.
- **Recommendation:** confirm as decided.
- **Decision:** Confirmed by the Owner, 1 Nov 2026. Everything about the engine is on the server; the app keeps tools and basic features only (`DECISION_LOG.md` E-01, U-01, U-02).

## O-02 Recording Browse-mode recommendations

- **Current approach:** for the MVP, Browse recommendations are stored like everyone else's, with no account link (DESIGN.md E-05).
- **What the sources require:**
  - PRD FR-M04-08 and NFR-07: "Store every recommendation with inputs, rules fired and versions."
  - PRD US-M01-03: "Browse mode stores nothing on the server." These two conflict for Browse users.
- **Constraints:**
  - Without a record, a report about something Browse mode recommended can't be investigated.
  - With a full record, the PRD promise to Browse users isn't kept, and the record is still health-related data even without a name.
- **Options:**
  1. Store normally (MVP choice).
  2. Store a **de-identified record**: rule set version, engine version, a one-way fingerprint (hash) of the input, the card and the trace. No device or person link, and the input can't be read back. Recommended after the MVP.
  3. Store nothing, as the PRD says.
- **Recommendation:** option 1 for the MVP. Move to option 2 before public launch, and update the PRD and privacy notice to say what is kept and why. Needs legal review.
- **Decision:**

## O-03 Who screens free text for risk language

- **Current approach:** free text and voice belong to another team (E-04). The engine receives standard values only.
- **What the sources require:**
  - Tab 11 layer 0: a classifier "FLAGS risk language (tuned for high recall). It never replies, reassures or decides."
  - SF-1: a flag stops everything and opens the support screen.
  - PRD FR-M14-02: "Run one safety classifier across Need, Dump, Express and Reflect text."
  - RF-5: Reflect text goes through it too.
- **Constraints:**
  - The phrase list is a safety rule and must be versioned with the rule set, so an incident can be traced.
  - If each team screens text its own way, the results will differ.
  - The current phrase list misses common wording (audit of 31 Oct 2026).
- **Recommendation:**
  - One shared safety-screen service that uses the phrase list from the **current rule set version**.
  - The free-text tool calls it before mapping anything.
  - Its result (flag, category, rule set version) is passed to the engine as an input.
  - The phrase list is owned in the rule set and signed off by Clinical Safety.
- **Decision:** Owner, 1 Nov 2026: screening free text is **outside this work**. It belongs to the AI and free-text team, who decide where it runs and who owns the phrase list, including whether anything runs in the app and what happens offline. This work only accepts the result as an input (IG-20) and implements the safety rules on standard values. Not built here, and no phrase check is added to the app (`DECISION_LOG.md` E-14). The recommendation above stays on record for that team.

## O-04 ADR 0007 interim safety rulings (Clinical Safety)

- **Current approach:** adopted for the MVP as *interim*:
  - the Hopeless chip triggers the safety override at any intensity;
  - the phrase list is expanded;
  - "Get support now" shows at distress 7+ in every band.
- **What the sources require:** Tab 2 (hopelessness at any intensity), Tab 11 (high recall), and every safety row "needs clinical sign-off" (Tab 12 G-SF2).
- **Constraints:** "any intensity" will sometimes open the support screen for mild hopelessness (e.g. about a bus). That's the safer error, but it may annoy users.
- **Recommendation:** sign off as written, or set a lower threshold explicitly. The rule then records who signed it off.
- **Decision:**

## O-05 Reviewing drift from the example tables

- **Current approach:**
  - The examples (Tab 0, 0b, 9, 6d F) are never pass/fail tests (ADR 0007 §1).
  - Each rule set version is run against them, and differences go to the drift register with the rule that causes them.
  - The current engine already differs from at least 6 examples. More are expected once the rules are applied strictly.
- **What the sources require:** the workbook README says Tab 9 is "for use as a unit test", and Tab 0 says "the source tabs remain the authority".
- **Constraints:** someone has to review each difference: either the example is wrong, or the rule changes.
- **Recommendation:**
  - The Owner reviews Tab 9 and the Red and Amber examples first.
  - Clinical Safety reviews any example involving the safety rows.
  - Everything else is reviewed in batches by tab.
- **Decision:** Owner, 1 Nov 2026: the example tables are **not used** (not as tests, not as a publish gate). The rule data decides. A rule that is logically broken is exempted and recorded as a gap with the context the Clinical Safety lead needs (`DECISION_LOG.md` E-10, E-11). The review process above is therefore replaced by the gap register. Still open: whether the example tabs stay imported as read-only reference (the recommendation is yes, never run).

## O-06 Clinical safety standard, medical-device status, keeping records

- **Current approach:**
  - The design keeps an immutable copy of every rule set version, a decision record for every recommendation, exact replay and a tamper-evident audit log.
  - Rules marked `safety` can link to hazard-log entries.
- **What may be required:**
  - **DCB0129:** the NHS clinical risk management standard for makers of health IT. It needs a clinical safety officer, a hazard log and a safety case.
  - **MHRA:** whether an app that recommends support for mental-health states is "software as a medical device" needs a legal view.
  - **UK GDPR:** decision records hold special-category (health) data.
- **Constraints:**
  - Account deletion crypto-shreds the user's data (DECISIONS B-04). That also makes their old decision records unreadable, so they can't be replayed after deletion.
  - Safety investigations may need them.
- **Recommendation:**
  - Get a legal view on medical-device status now; the design works either way.
  - Agree a retention rule: on deletion, keep the de-identified part (versions, input fingerprint, card, trace) for a fixed safety-retention period, and state it in the privacy notice.
- **Decision:**

## O-07 Who approves rule changes

- **Current approach:**
  - Product Owner approval for any change.
  - Product Owner **and** Clinical Safety for rows marked `safety`: the band rules, the safety lexicon, crisis routes, Reflect and Meditate gates, the Regulate/Connect tiers and the safety floor (ENT-9).
- **Constraints:** two-person approval for everything is safer but slower.
- **Recommendation:** keep it as above; a person can't approve their own change.
- **Decision:** Owner, 1 Nov 2026: for now a single **clinical admin** drafts, approves and publishes. The fuller scheme above is on the development TODO to tighten later (`DECISION_LOG.md` E-20, `TODO.md`).

## O-08 AI help when mapping prose rules

- **Current approach:** prose rules (Tabs 2, 7, 8, 10, 6c) are mapped to the engine format by hand, in a reviewed mapping file.
- **Option:** a self-hosted model drafts the mapping for each row; a person confirms or corrects every one. Nothing is used unconfirmed.
- **Constraints:** faster import, but every interpretation still needs a human review, and the model must not see user data (it doesn't; it only sees workbook text).
- **Recommendation:** allow it for drafting only.
- **Decision:**

## O-09 The rule store or the spreadsheet: which is the master copy

- **Current approach:** the first version is imported from the Google Sheet. Any version can be exported back to `.xlsx` in the same layout (DESIGN.md §6).
- **Constraints:** if both are edited, they drift apart.
- **Recommendation:**
  - After the first import, **the rule store is the master copy**.
  - The workbook author can still work in a spreadsheet: export, edit, re-import. The re-import creates a draft with a clear list of changes, which goes through the normal approval.
- **Timing problem found:** the recommendation says the store is master after the first import, but `DESIGN.md` §12 built the editor last (step 4, after the viewer, simulator, explorer and query). Between the first import and the editor, the store would be master with no way to edit it except by fixing the spreadsheet and re-importing everything.
- **Decision:** Owner, 1 Nov 2026: the rule store is master **from the first import**, because the spreadsheet has problems of its own. A clinical admin must be able to **add or change a single rule in the dashboard** without re-importing the workbook; re-import stays available for bulk changes. The editor is therefore built early. First version to be improved after it is seen (`DECISION_LOG.md` E-12).

## O-10 Input values that aren't standardised

- **Current approach:** the engine will accept only agreed standard values. 22 input items were checked; 4 are standard and 18 have gaps (`INPUT_GAPS.md`).
- **Blocking the MVP engine:**
  - IG-02 Not-sure answers;
  - IG-03 feeling chips and families;
  - IG-04 skipped intensity;
  - IG-05 sensations and flags;
  - IG-07 environments and setting classes;
  - IG-12 needs;
  - IG-15 number of tasks;
  - IG-16 timeline numbers;
  - IG-17 demand characteristics;
  - IG-20 risk inputs;
  - IG-21 system signals;
  - IG-22 re-check.
- **Recommendation:**
  - Go through `INPUT_GAPS.md` with the founder in one session.
  - IG-04, IG-05 (warning signs) and IG-20 also need Clinical Safety.
  - Where the workbook has a list, use it as the standard, and change Figma to match.
- **Working default while this is open (Owner: proceed, record it):** the engine is built against the workbook's lists; where only Figma has a list, Figma's values are used and marked `interpreted` until the founder confirms them. Several of these mappings (chip to family, sensation to flag, environment to setting class, picture answers to cell) are rules in their own right. Proposal: give each its own rule-set table, marked as an addition (`DESIGN.md` §3.4). See `DECISION_LOG.md`.
- **Decision:**

## O-11 Safety rules without clinical sign-off

- **In plain terms:** the engine decides when a person is shown crisis help and what is held back around it. None of the rules below has been confirmed by the clinical lead. They are built and flagged, and they stop a safety row from being published to production without Clinical Safety (O-07).
- **What is unsigned:**

| # | Rule | Sources | State |
|---|---|---|---|
| 1 | The "Hopeless" chip starts the safety override | Workbook Tab 2 (hopelessness is immediate-risk language), Tab 10 SF-1; CONFLICTS D-07; build DECISIONS B-10 (override only at 7–10; lower counts as sadness); ADR 0007 §7 (interim: **any** intensity; a skipped intensity never hides it); INPUT_GAPS IG-04, IG-20 | Interim. The build and the ADR differ. |
| 2 | The risky-phrase list | ADR 0007 §7 (expanded with variants, extra words, slang); audit of 31 Oct 2026 (the old list missed common wording); BLOCKERS X-02; `packages/rules-compiler/src/catalogue/rules.ts` | Unsigned. Ownership of free-text screening has moved to the AI team (O-03, E-14). |
| 3 | "Get support now" shows at distress 7+ in every band | ADR 0007 §7; Workbook Tab 2 distress row, Tab 9; Tab 10 (Red always shows it) | Interim |
| 4 | Workbook rows the workbook itself marks "needs clinical sign-off" | Workbook Tab 12: G-EM13, G-SF1, G-SF2, G-IN1 (prompt copy), G-IN2, G-IN4; RC-5 pathway (`docs/build/ENGINE_AUDIT.md`, "Tab 12 gaps"); Workbook README (every safety row) | Built as written |
| 5 | Open workbook items | CONFLICTS D-36: E4M1 baseline rule ("v3 - confirm"), NS-1 ("confirm"), pattern 6 against 8, proposed traffic-light colours, every threshold "MVP starting point" | Built as versioned data |
| 6 | Physical warning signs (chest tight with short of breath, dizzy, heart racing) | INPUT_GAPS IG-05 point 4 | No rule exists |
| 7 | Help/SOS wording ("You can do this") | CONFLICTS D-21; PRD FR-M14-01, NFR-06 | Unsigned |

- **Constraints:**
  - "Any intensity" on the Hopeless chip will sometimes open the support screen for mild hopelessness. That is the safer error, but users may find it intrusive.
  - Not a blocker for development: the rules are versioned data. It blocks launch.
- **Recommendation:** one review pack for the Clinical Safety lead made from this table plus the safety-related gap records. Each approved row records who signed it, when, and in which rule set version. Production publishes only signed `safety` rows.
- **Decision:**

## O-12 SF-2 against "we do not monitor check-ins in real time"

- **In plain terms:** SF-2 notices that someone has been in the lowest state for a week or more and changes what they are shown. That is the system watching a person's states over time. The privacy notice tells users the opposite.
- **Current approach:** SF-2 is a daily job in the API (`apps/api/src/modules/safety/sustained.ts`, per `docs/build/ENGINE_AUDIT.md`). It changes only what the user sees and notifies no staff (the D-19 recommendation, adopted in build DECISIONS B-13). Engine v2 has no input for it yet (IG-21 lists no "sustained state" signal).
- **What the sources require:**
  - **Workbook Tab 10, SF-2 and Tab 12 G-SF2:** Very Constrained for 7+ days, or 14+ with no improvement, escalates the support route. Marked for clinical sign-off.
  - **Privacy Notice §5:** "We do not monitor check-ins in real time."
  - **Figma S119, S161:** "Escalation is triggered"; "Escalations reviewed weekly by Clinical Safety". That is monitoring by staff.
  - **CONFLICTS D-19** (and D-18, automatic sharing).
- **Constraints:** a daily job is not "real time", but it is still automated watching of a person's states, and the weekly review in Figma would be staff monitoring. The notice must say what happens.
- **Options:**
  1. SF-2 only changes what the user sees (a gentle "it's been a hard week" card with routes). No staff are told. The notice says so.
  2. Remove SF-2 from the MVP.
  3. Staff review, with a notice change, a data protection impact assessment and a clinical process.
- **Recommendation:** option 1. For v2, define the sustained-state signal as an input (IG-21) computed outside the engine.
- **Decision:**

## O-13 Support without a check-in (D-39)

- **In plain terms:** a person taps "I need help with…" and goes straight to the Need screen without a check-in. The engine needs a state (the light) to know what is safe to offer. Nothing in the documents says what to assume.
- **Sources:** Figma S05 ("I need help with…") and S11 ("I just want support"); PRD §3 support-only flow; Workbook Tab 8 steps 1 and 2 (the user may state a need or check in, but Energy × Mood is what everything else builds on); Workbook Tab 10 NS-1 ("Not sure" is Yellow, marked "confirm"); CONFLICTS D-39 (full analysis and recommendation).
- **Current approach:** the build adopted the D-39 recommendation (DECISIONS B-13): use a check-in from the last few hours (the recommendation says e.g. 4, configurable); otherwise show one skippable Energy × Mood screen; if skipped, treat as "Not sure" (Yellow baseline, EX-1 still applies if a strong feeling is logged, nothing raises it); with no specific need either, offer a short choice of free support with Help visible.
- **Constraints:** Yellow for someone who may be struggling could offer too much. Amber forces support first, Red defers tasks (Tab 10).
- **What v2 needs:** the input contract must say how "no state" is sent (for example state `not_sure` with a source of `skipped`) and the 4-hour window must be a named threshold in the rule set.
- **Recommendation:** keep the build's behaviour. Clinical Safety confirms Yellow as the default for an unknown state.
- **Decision:**

## O-14 Product decisions the engine rests on (provisional)

- **In plain terms:** `CONFLICTS.md` has 39 open product questions (D-01 to D-39) and nearly all have an empty Decision line. The repo rule is that agents do not decide product questions. When the build ran overnight, it used each item's recommendation, recorded as `B-xx` in `docs/build/DECISIONS.md` (mainly B-13). Everything below is therefore **provisional**, and any behaviour resting on it should be confirmed.
- **The ones that change what the engine does:**

| D-xx | Topic | What the build used | Recorded in | Why the engine cares |
|---|---|---|---|---|
| D-02 | Age rule | 18+ self sign-up; 16–17 only through an institution; no purchases under 18 | B-13, B-44; ENT-8 | Entitlement and sign-up rules |
| D-06 | Band names on screen | Plain wording: Good to go, Go gently, Reduce the load first, Take care first, Steadier | B-13 | Card labels and the light |
| D-07 | Hopeless chip | Override at 7–10 (the ADR later said any intensity) | B-10; ADR 0007 §7 | Safety override (O-11) |
| D-08 | Need list: 12 in Figma, 21 in the workbook | 12 at top level with "More…" | B-13 | The need drives the route (IG-12) |
| D-09 | Emotion chips against families | The build's own chip-to-family table | B-10, B-13 | Which family fires which rule (IG-03) |
| D-13, D-15 | Plans and Free/Advanced labels | One Advanced entitlement with configurable prices; PRD tiers | B-13; BLOCKERS X-01 | Entitlement filter ENT-1 to ENT-9 |
| D-18, D-19 | Automatic sharing, escalation | No automatic sharing; SF-2 only changes what the user sees | B-13 | SF-2 (O-12) |
| D-24 | Two Red cards | Use the Figma S154 pattern | B-13 | The Red card |
| D-26 | Feedback scale | 1–5, mapped to helped, a bit, not really | B-13 | RC-1 "support completed" and "helped" (IG-22) |
| D-36 | Workbook "confirm" items | Built as written, as versioned configuration | B-13 | Band rules |
| D-39 | Support without a check-in | The recommendation (O-13) | B-13 | Missing state |

- **Recommendation:** the Owner confirms or changes these in one session. Each confirmed item gets its Decision line filled in `CONFLICTS.md`. Until then the v2 rule set marks the rows that depend on them as "decision pending".
- **Decision:**

## O-15 Decision records: replay, hashing, encryption, Browse and deletion

- **Current approach:** at this stage nothing in v2 is encrypted (Owner, 1 Nov 2026). Records keep the structured standard-value input. This must be resolved, with code changes, before launch (`DECISION_LOG.md` E-13).
- **What the sources require:**
  - **PRD FR-M04-08, NFR-07:** store every recommendation with its inputs, the rules fired and the versions.
  - **`DESIGN.md` §7:** replay any record on its original rule set and engine version and get the identical card; a daily job replays a sample; personal data in the record is encrypted with the user's key.
  - **PRD US-M01-03:** "Browse mode stores nothing on the server."
  - **Build DECISIONS B-04:** deleting a user crypto-shreds everything they wrote.
- **The problems found:**
  1. **A hash can't be replayed.** O-02 option 2 stores a one-way fingerprint of the input; replay needs the real input.
  2. **Deletion makes records unreplayable** if they are encrypted with the user's key (O-06).
  3. **Browse users have no user key**, so there is nothing to encrypt their record with.
  4. **The daily replay job would need access to health inputs** for every sampled record.
  5. **Storing the full trace duplicates replay:** if replay is exact, the trace can be rebuilt on demand instead of stored with every recommendation. The trace is large (every rule checked and the facts at every stage).
- **Options for what a record keeps:**
  - **A.** The structured standard-value input as codes, with no account link for Browse users, plus the card and the versions. Replayable. The trace is rebuilt on demand.
  - **B.** A one-way fingerprint. Not replayable.
  - **C.** Nothing (the PRD's Browse promise).
- **Recommendation:** A. The input is codes, not free text, and carries no link to a person for Browse. On deletion, keep the de-identified part for a fixed safety-retention period and state it in the privacy notice. Needs a legal view (O-02, O-06).
- **Before launch:** enable encryption; agree retention; update the privacy notice and PRD US-M01-03.
- **Decision:**

## O-16 What the public API returns

- **Current approach:** `DESIGN.md` §10: `POST /v2/recommendations` returns the card, a trace summary and the versions, for signed-in and Browse users. §6 lets any version be exported to `.xlsx`.
- **Question:** with the engine on the server, the rules can't be read from the app, but a caller who can send any input and read a trace could learn the rules by probing. A full export hands them over.
- **Recommendation:** the public response carries the card and the versions only. The trace and the export are staff-only.
- **Decision:**

## O-17 Where data ends and code begins

- **Principle (Owner, 1 Nov 2026, `DECISION_LOG.md` E-09):** the main rules are data, in the workbook's own structure, so new rules can be added and wrong ones fixed without a release. Code changes only when something major or the approach changes. Some logic stays in code.
- **What stays in code:** running the stages in order, evaluating conditions, applying effects, requirement-against-proposal handling, building the trace.
- **The edge:** `DESIGN.md` §4.3 lists a closed set of effects. A rule that needs an effect outside it needs a code change and a new format version. Examples that may not fit: "pain at High+ beats non-safety families" (a ranking rule, stored as an addition from ADR 0007 §2); Pattern 13 with a single flag (deferred); RC-1 "improved" (compares two check-ins).
- **Recommendation:** accept this. During the first import, list every row that can't be expressed as `unresolved` and show the author, so the effect list can grow where the author needs it.
- **Decision:**

## O-18 What the engine does while a rule is exempt

- **Context:** an exempt rule (a rule that is contradictory, undefined or incomplete: `DECISION_LOG.md` E-10, E-11) is not run. Something must say what the engine does in its place.
- **Options:**
  1. Behave as if the row doesn't exist.
  2. Keep the interim ruling from ADR 0007 for that case until it is settled.
  3. For a `safety` row, block publishing until Clinical Safety has seen the exemption, because a missing safety rule weakens safety.
- **Recommendation:** option 1 for ordinary rows. Option 3 for `safety` rows. Every exemption shows in the dashboard and in the trace ("rule X exempt").
- **Decision:**

## O-19 Check-in safety choices made for the MVP (Clinical Safety)

- **Current approach:**
  - **Unrated feelings:** a feeling the user didn't rate counts as High for harder families and Mild for lighter ones (E-42).
  - **Hopeless prompt:** tapping Hopeless offers "Get support now" at once, without blocking (E-43).
  - **Hopeless as a family:** the Hopeless chip maps to "Immediate risk language" (E-40).
- **Sources:**
  - Tab 2 ("Immediate risk language … selected option");
  - SF-1;
  - ADR 0007 §7;
  - PRD ("Skip is always available");
  - INPUT_GAPS IG-04 and IG-20.
- **Constraints:** a skipped rating must never read as mild for a harder feeling. A prompt must not shame or alarm.
- **Recommendation:** keep the three choices until the Clinical Safety lead rules on them, then change the data and the engine rule.
- **Decision:** ________

## O-20 How Advanced (Plus) tools are offered on the card

*Decided by the Owner on 3 Nov 2026 (DECISION_LOG E-62). Written for the founder, to confirm or change.*

### In plain terms

Every pathway has free tools and Advanced (paid) tools. The workbook (Tab 6d) says two things about them on the recommendation card:

1. **Holding back.** Without a paid plan, an Advanced tool is never the main suggestion. Under strain (Amber, Red, a hard feeling at High or above, a recent safety event, during a session) no Advanced tool is shown at all. Otherwise at most one, labelled "Advanced", with the upgrade shown only if the user taps it (ENT-1, ENT-3). In Amber and Red every plan gets only the free safety-floor tools.
2. **Offering.** A Plus user gets "the best-fit tool the user's plan includes". On a calm card (Green, Yellow, Blue) "Advanced tools may appear as ONE labelled alternative". The workbook's examples show it: in ENT.2 (Full Flow, restless, at home) the Free user sees "Move, with Create [Advanced] as an alternative", and the Plus user may get "Create or Advanced Movement" first.

### What we found

- **Holding back worked.** Tested over about 8,000 check-ins on every plan, it was never broken.
- **Offering had never been built.** Inside a pathway, the engine always took the first tool on the list, and the free tools come first. So a Plus user got the same card as a Free user. Only 2 of the 44 Advanced tools ever appeared (on about 1 Plus card in 100), and the Free user's labelled Advanced alternative appeared on 19 cards in about 9,600.

### What the Owner decided (3 Nov 2026)

1. **Plus gets the fuller version of a suggested tool.** Where Tab 6d names an Advanced tool as the fuller version of a free one, a Plus user gets it in the free one's place:

   | Free tool | Fuller version (Plus) |
   |---|---|
   | Move | Advanced Movement |
   | Sounds | Advanced Sounds |
   | Basic breakdown | Full breakdown |
   | Voice capture | Longer voice notes |
   | Manual sorting | AI sorting |
   | Move an item to a task by hand | One-tap convert |

   - **Why:** "best fit" isn't defined in the workbook. The only reading that doesn't guess is the one the workbook spells out: these Advanced tools are the same thing with more depth.
   - **Not in Amber or Red:** there the safety floor stays, for every plan.
   - **Not the guided settles:** the 10 and 20 minute settles are longer, not fuller, and how long a session lasts is a clinical choice (the minutes cap).
2. **A calm card offers one Advanced tool beside the suggestion.** This applies on Green, Yellow and Blue, and never under strain.
   - **For Free users** it is the labelled taster ("Advanced", upgrade on tap).
   - **For Plus users** it is simply another of their tools, and only when the card has no Advanced tool yet.
   - **Which tool:** one from the same pathway as the suggestion, a tool of a new kind first (Create, Scripts, Photo capture). A fuller version comes next, but never the paid version of the tool already beside it.
     - **Why:** a Free user who sees Move next to "Advanced Movement" is being sold more of the same thing. A different kind of tool shows what Plus adds. This is also what ENT.2 shows: Move, with Create.
3. **The Advanced tool never pushes out a support option.** It takes a free alternative place. If both are taken, it may replace a navigation action such as "Check in again", but never a support tool or pathway.
   - **Why:** our first version replaced whatever was last. It then pushed out a free support option in 1,018 of 2,218 cases, including free Regulate tools (569), Connect (73) and the user's own practice. Tab 6d opens with "Money never decides whether someone gets support", so that was wrong. A test now checks this for every check-in.

### What it gives

| Workbook scenario | Free | Plus | As the workbook? |
|---|---|---|---|
| ENT.1 Ground First (Amber), overwhelm 7, at work | Safety-floor tools only | Same as Free | Yes |
| ENT.2 Full Flow (Green), restless, at home | Move, with **Create [Advanced]** | **Advanced Movement** in place of Move | Yes |
| ENT.4 Flow Entering (Yellow), adjustment meeting T2 | Simplify, with one Advanced Express tool (Draft) | Same as Free | Free yes; **Plus no** (see below) |
| ENT.6 Red, distress 9 | Safety floor and "Get support now" | Same as Free | Yes |

**How often, over the explorer's check-ins:**
- **Free:** an Advanced tool on 33% of cards (54% of calm cards), never as the main suggestion.
- **Plus:** an Advanced tool on 36% of cards (58% of calm cards), as the main suggestion on 71. 14 different Advanced tools appear, where 2 did before.

### What is not built, and why

**ENT.4's Plus column** (Self-advocacy prep, then Express Scripts) comes from reading the context: the task is an adjustment meeting, so Scripts "for meetings, calls and presentations" fits. No general rule gives that. Building it from the one example would mean fitting the engine to an example table, which is what made engine v1 break the workbook's rules (E-01, ADR 0007). If the founder wants context-based picks, they need rules such as "a task about a meeting: Scripts first in Express". Those can be added as rule rows.

### If the founder wants it differently

Each choice is rule data in the Tab 6d rows. The clinical admin can change it in the staff app (Rules → a draft version → the `tools_tiers` tab), check it in the Simulator and the Explorer, and publish. Nothing needs a release, except where marked.

| Choice | Today | Other ways | How to change |
|---|---|---|---|
| Which Advanced tool is a "fuller version" | The six pairs above | Add pairs (e.g. the 10 minute settle for the 5 minute one), or remove some | Edit the pathway rows of Tab 6d (`tools.version`) |
| When Plus gets the fuller version | Green, Yellow and Blue | Also at High intensity, or never | Edit the Green, Yellow and Blue rows (`tools.upgrade`) |
| When the one Advanced alternative is offered | Calm cards, not under strain | Less often (only Green), or for Free users only | Edit the same rows (`tier.offer`) |
| Which Advanced tool is offered | A new kind first, from the suggestion's pathway | The pathway's fuller version first; the workbook's list order | Engine change (E-62) |
| What it may replace | A free place, or a navigation action; never support | A free place only (fewer offers) | Engine change (E-62) |
| Context picks (ENT.4) | None | Rules per context, e.g. a meeting means Scripts | New rule rows, written with the founder |

- **Recommendation:** keep the three choices. Decide whether Plus should differ from Free more strongly; today the main difference is the fuller versions and the main suggestion.
- **Decision:** Owner, 3 Nov 2026: as above. Founder: ________

