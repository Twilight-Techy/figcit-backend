# 0007: The engine follows the workbook's rules, not its example scenarios

- **Status:** Accepted (31 Oct 2026). Items marked *interim* are adopted now and still need Clinical Safety sign-off before launch.
- **Number:** written as 0001 on the engine v2 branch; numbered 0004 when it joined `main`, which had taken 0001-0003 for the AI model records.
- **Decided by:** Owner, approving the recommendations from the engine audit of 31 Oct 2026.
- **Supersedes:** DECISIONS B-07 (calibration from the scenario tabs), B-09 (pattern 15 needs a High+ trigger) and B-40 (Red "Start small" exception).

## Context

The Rules Engine v3.3 workbook is the authority for engine behaviour (PRD §8, workbook README). Its rule tabs are 1, 2, 3a/3b, 4, 5, 6, 6b, 6c, 6d, 7, 8, 9, 10, 11 and 12. Tab 0 and Tab 0b are example scenarios; Tab 0 says "The source tabs remain the authority". The tab named "Sheet1" is scratch work and holds no rules.

An audit (31 Oct 2026) found that the engine was calibrated to reproduce the example scenarios where the rule tabs are silent or contradict each other. That broke rules in the rule tabs, mostly in Red and Amber and in the safety screen, and the tests were written to match the engine rather than the workbook (e.g. `test/worked-example.test.ts` asserts the opposite of Tab 9 on drivers).

The workbook itself has gaps and contradictions. This record settles them for the MVP.

## Decision

### 1. Source of truth

- The rule tabs decide behaviour. The example tables (Tab 0, Tab 0b, Tab 9, Tab 6d section F) are not tests the engine must pass.
- Every example is run against each rule set version, and any difference is recorded in the drift register with the rule that causes it. The engine is never changed to match an example.
- If the Owner or the Clinical Safety lead decides an example is right, the **rule** is updated through the normal rule-change process.
- Tab 9 drift is reviewed first, because the workbook calls it a unit test.
- Gaps and contradictions in the rules are settled by this record, not by fitting to examples. (Amended 1 Nov 2026; see `docs/engine-v2/DESIGN.md`.)
- **Amended 1 Nov 2026 (Owner):** the example tables are not used at all, neither as tests nor as a publish gate, and there is no drift register. The rule data decides. A rule that is logically broken is exempted and recorded as a gap for the Clinical Safety lead. See `docs/engine-v2/DECISION_LOG.md` E-10 and E-11. The two paragraphs above on running the examples and reviewing Tab 9 drift no longer apply.

### 2. Rule order (precedence)

Tab 7 says to match on the band first and refine by trigger. The engine runs in this order:

1. **Safety override** (pattern 28).
2. **Guards:** shutdown (16), sensory overload High+ (19), meditation guard (41), rumination guard (40).
3. **The band sets what is allowed:**
   - **Red:** a care step leads, "Get support now" is visible, and tasks are deferred (except point 3).
   - **Amber:** a support step leads, tasks are limited to Routine or the smallest step, and "I'll try the task anyway" is always visible.
   - **Yellow / Green:** open, subject to points 4 and 5.
4. **Within what is allowed,** the feeling, sensation or need picks the action (Tab 2, Tab 6b, Tab 7 patterns 9–27, 29). Among them, pain at High+ beats non-safety families such as boredom.
5. **A task due now (T0)** beats optional Reflect and Meditate offers (patterns 32–39).
6. **Optional Reflect and Meditate offers** come last, still gated by RF-1–RF-5 and MD-1–MD-6.

### 3. Red with a task due now (T0)

Patterns 7 and 15, Tab 4 and G-CX2 conflict. Red + T0 gets:
- a 1-minute reset as the primary;
- the smallest step queued after it;
- "Get support now" visible.

"I'll try the task anyway" is never shown in Red.

### 4. Amber with no or mild trigger and a task

No pattern covers this. It gets:
- a short reset as the primary;
- "Start small" (Routine or the smallest step) as an alternative;
- "I'll try the task anyway" always visible.

This also settles Tab 1 E1M4 "none forced" against Tab 10 "intervention is the forced primary".

### 5. Yellow with no trigger and a non-routine task

No pattern covers this. It follows Tab 10: an optional 2-minute reset with "Skip to task" visible.

### 6. Tab 1 default lean (MVP scope)

The four states whose lean says "Regulate first" get a reset first even with no feeling selected:
- E2M1 Ground First;
- E3M1 Activate;
- E4M1 Regain Base;
- E4M2 Storm Mode.

The lean's NUCRIPCE hints are not used in the MVP.

### 7. Safety *(interim, needs Clinical Safety sign-off)*

- **Hopeless chip:**
  - The safety override fires at **any** intensity, as Tab 2 says.
  - A skipped intensity never hides it.
- **Safety phrase list:**
  - Expanded now with common variants, phrases with extra words in between (e.g. "end my own life"), split words ("kill my self") and common slang ("unalive", "kms").
  - The list then goes to Clinical Safety for sign-off before launch.
  - A model-based classifier (Tab 11 layer 0) is a later decision.
- **Distress at High+ (7–10):** "Get support now" is visible in every band (Tab 2 distress row, Tab 9).

### 8. Smaller rulings

- **E4M1 with both EX-1 and CX-1:** the band stops at **Constrained** (the specific E4M1 rule beats CAP-1).
- **Re-check "improved" (RC-1):** measured on harder (negative) feelings only. A stronger positive feeling never counts as worse.
- **Blue recovery light:**
  - It shows on the re-check that earned it.
  - A later check-in during the recovery window shows Blue only if it is not worse than that re-check.
  - Blue never covers a worse check-in.
- **Unchanged re-check (RC-4):** keeps the previous light but may still drop it for a new modifier, such as CX-1 in a new setting.

### 9. Workbook inconsistencies settled

- **Tab 9 vs pattern 5:** Tab 9 lists "Get support now" as an Amber alternative but pattern 5 doesn't. Point 7 decides it: shown when distress is High+.
- **Amber drivers:** Amber keeps Urgency at T0/T1 alongside Routine, as pattern 5 and Tab 9 say.

## Deferred (not in the MVP)

- Tab 3a effects for Crowd, Smell, Temperature, Touch and Noise. The audio and screen filters stay.
- Tab 1 NUCRIPCE hints; stored interests for the Interest/Passion drivers; TR urgency from the next occurrence.
- The "imposed" and "transition" task types, and the "stopping" → Adapt stop-point flow.
- Morning vs evening for opening and closing rituals; per-topic Reflect blocking (RF-2); personal time-of-day patterns (G-ST4).
- Pattern 13 with a single sensitivity flag; the Meditate alternative for High+ anticipatory unease; context defaults for gym/outdoors and "somewhere else".
- Deleting "Sheet1" from the workbook (owner's task).

## Consequences

**Plain bugs** against clear rules are fixed without further decisions:
- Urgency kept in Amber at T0/T1.
- Mild anxiety and restlessness in Green as alternatives, not the primary.
- Sensory overload only at High+.
- Overdue tasks start with repair.
- "Consequence" and "event prep" give Urgency only at T0–T2.
- Card labels match the tool opened.
- Relief at low energy: rest first.
- "It's time for…" only when the practice is due.
- No Meditate in an exam hall.
- "Prepare to speak up" in Amber gets "save for later".
- "Prepare for an event" routes to Adapt then Execute.
- The TX urgency comes from the snapshot, not code.

**Tests:**
- Engine tests are written from the rules, never from the example tables.
- The example tables feed the drift register only.
- New rule tests cover points 2–8.

**Clinical Safety sign-off:** the items in point 7 stay flagged until signed off (BLOCKERS X-02).

**Changes are additive:** the engine version and snapshot version change. Recommendations logged before the change keep their old versions, so they can still be replayed.
