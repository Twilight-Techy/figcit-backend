# Engine inputs: standardisation check and gaps

- **Status:** For clarification by the founder (and the Clinical Safety lead where marked). Checked 1 Nov 2026.
- **Purpose:** the v2 engine accepts only standard values (DESIGN.md §5). This file lists every input the engine reads, whether its values are standardised across the sources, and what needs clarifying.

**Sources compared:**

| Short name | Source |
|---|---|
| Workbook | Rules Engine v3.3 (Google Sheet, identical to `docs/specs/rules-engine-v3.3/`) |
| PRD | PRD/FRD v3.1 |
| Activity | Activity Tables v2.1 |
| Figma | Figma file `26iYxW66UY3vvAbpLKQEsT`, page "UI Design" (check-in screens S06–S12, S90–S92, S150–S152, S25) |

The workbook decides behaviour; Figma decides layout only. Where a value list exists only in Figma, it isn't standard until the founder confirms it.

**Status key:**
- **Standard:** the same values in every source that mentions them.
- **Partly:** the concept is agreed, but values, labels or meaning differ.
- **Not standard:** no agreed list of values, or no rule says what the input does.

Free text and voice are out of scope (DESIGN.md E-04). This file covers the standard values that tool must produce.

## Summary

| ID | Input | Status | Blocks the MVP engine? | Decider |
|---|---|---|---|---|
| IG-01 | Energy and Mood | Standard | — | — |
| IG-02 | "Not sure" picture answers and how they suggest a state | Not standard | Yes | Founder |
| IG-03 | Feelings (emotion chips) and their families | Not standard | Yes | Founder, Clinical Safety |
| IG-04 | Intensity, including "skipped" | Partly | Yes | Founder, Clinical Safety |
| IG-05 | Sensations and the flags they set | Not standard | Yes | Founder, Clinical Safety |
| IG-06 | Body map regions | Not standard | No (no rule uses it) | Founder |
| IG-07 | Environment and its setting class | Partly | Yes | Founder |
| IG-08 | Who's around (social setting) | Partly | No (no rule uses it) | Founder |
| IG-09 | Time / transition | Not standard | No (no rule uses it) | Founder |
| IG-10 | Available support | Partly | Partly (headphones only) | Founder |
| IG-11 | Sensitivity flags | Standard | — | — |
| IG-12 | Needs | Partly | Yes | Founder |
| IG-13 | "I just want support" | Standard | — | — |
| IG-14 | Kind of task | Not standard | No (no rule uses it) | Founder |
| IG-15 | Number of tasks | Partly | Yes (pattern 22) | Founder |
| IG-16 | Timeline: urgency weights, step caps, recurring | Partly | Yes | Founder |
| IG-17 | Demand characteristics: values and who sets them | Not standard | Yes | Founder |
| IG-18 | Stored interests and values | Not standard | No (deferred) | Founder |
| IG-19 | Entry route | Standard | — | — |
| IG-20 | Immediate-risk inputs | Not standard | Yes | Clinical Safety |
| IG-21 | System signals | Partly | Yes | Founder |
| IG-22 | Feedback and re-check | Partly | Yes (RC-1) | Founder |

## Details

### IG-01 Energy and Mood: Standard

Energy: Very Low, Low, Moderate, High (1–4). Mood: Very Bad, Bad, Neutral, Good (1–4). The 16 cells, names, icons and meanings are in Tab 1, and every source agrees. No action.

### IG-02 "Not sure" picture answers: Not standard

- **Workbook** (Tab 11 layer 2b, Tab 7 p27): "3 picture-based taps: body, energy, comfort" suggest a cell for the user to confirm. No answer values, and no rule for how answers become a cell.
- **Activity** (Process 3, step 4): the Admin "sets up … how answers suggest a state". Still no values.
- **Figma S150:**
  - Body: Heavy / Floaty / Buzzy / Settled.
  - Energy: Empty / Low / Some / Full.
  - Comfort: Hard / Uneasy / Okay / Good.

  S151 shows an example (heavy · low · uneasy → Slow Warm).
- **Gaps:**
  1. Confirm the Figma answer values as standard.
  2. Provide the table from answers to a suggested cell; there are 64 combinations.
  3. What happens if the answers fit no cell? The workbook says to stay Conditional (NS-1) only if the user remains unsure.

### IG-03 Feelings (emotion chips) and families: Not standard

- **Workbook** (Tab 2): families with example words ("Overwhelmed, panicked, can't cope"). No chip list and no codes.
- **PRD:**
  - US-M03-01: chips with emoji, up to 3, families from Tab 2 rows 1–38, including the v3.2 families.
  - US-M03-01.2: "Emotion list and family mapping from Tab 2 (rows 1–38)".
- **Figma S07:**
  - Harder: Anxious, Sad, Tired, Frustrated, Overwhelmed, Restless, Angry, Numb, Foggy, Lonely, Distress, Hopeless, Grief, Loss, Shame, Guilt, Uneasy about what's coming, Going over and over it.
  - Lighter: Calm, Happy, Hopeful, Grateful, Relieved, Curious, Excited, Focused, Content.
- **Gaps:**
  1. **No agreed chip-to-family table.** Chips with no obvious family: Tired, Foggy, Distress (vs Overwhelmed), Hopeless (a risk row, see IG-20), Loss, Hopeful, Curious, Focused.
  2. **Families with no chip in Figma:** Racing thoughts, Word-finding, Misaligned ("this way isn't working"), Task paralysis, Sensory overload, Hyperfocus, Boredom, Social hangover, Confusion, Rejection sensitivity, Wanting to make sense, Need for stillness, Spiritual / faith need. Some appear as sensations instead (IG-05). Decide which families are chosen as a feeling, which come from a sensation, and which from a need.
  3. **PRD lists "recurring struggle" as a selectable family.** The workbook says it is system-led (3+ times in 14 days, confirmed by the user). Which is right?
  4. **The same idea appears twice:**
     - "Restless" is both a feeling (S07) and a Movement sensation (S09d);
     - "Numb" (feeling) vs "Shutdown" (Cognitive sensation) vs "Frozen / stuck" (Movement);
     - "Calm / content" (Tab 2 row) vs "Gratitude / contentment" (Tab 2 row).

     When both are picked, does the engine count it once or twice?
  5. "Distress / overwhelm" is the only family that surfaces the Support pathway (Tab 2). Confirm which chips belong to it.

### IG-04 Intensity: Partly standard

- **Standard:** 0–10, banded Mild 0–3, Moderate 4–6, High 7–8, Very High 9–10 (Tab 2, PRD, Figma S08).
- **Gaps:**
  1. **Skipped intensity.** PRD says "Skip is always available", and Figma S08 has "Skip intensity", but no source says what value the engine uses. This matters for safety: a skipped "Overwhelmed" or "Hopeless" must not read as mild. (Clinical Safety.)
  2. Tab 2 says "use the HIGHEST intensity among them" (one peak). Several rules read the intensity per family. Confirm both are intended.

### IG-05 Sensations and the flags they set: Not standard

- **Workbook:** six categories (Sensory, Cognitive, Body, Communication, Movement, Interoception). Pain has its own intensity. Interoception covers hunger, thirst, toilet, sleepiness and too hot/cold. Rules read flags: pain, shutdown/freeze, detached/unreal (MD-2), sensory overload level, racing, word-finding, restlessness, hyperfocus, interoception unmet.
- **PRD** (US-M03-02, FR-M03-02): the same categories; shutdown, detached/unreal and overload level "as flags the engine can read".
- **Figma S09–S09e:** about 80 values, e.g. Body: Tension … Contractions; Cognitive: Brain fog … Zoning out; Interoception: Hungry … Calm inside.
- **Gaps:**
  1. **No source says which sensation sets which flag.** E.g. does "Blank mind" or "Zoning out" mean shutdown? Does "Frozen / stuck" mean freeze? Does "Overstimulated" give an overload *level*?
  2. **"Detached / unreal"** is required by MD-2 and FR-M03-02 but doesn't appear in Figma.
  3. **Interoception values don't match:**
     - Figma has no "sleepy";
     - "Too hot / Too cold" sit under Sensory in Figma but under Interoception in the workbook;
     - Figma adds Heart racing, Short of breath, Chest tight, Nausea, Dizzy.
  4. **Physical warning signs** (chest tight + short of breath, dizzy, heart racing) have no rule. Should any of them show Help, or a medical prompt? **(Clinical Safety.)**
  5. **Intensity:** the workbook gives pain its own intensity. Figma has one optional intensity per category. Which applies, and what value is used when it's left blank?

### IG-06 Body map regions: Not standard

Activity lists "head, chest, stomach, arms, legs, etc."; Figma shows Head, Chest, Stomach. The list is open-ended, and no rule uses it. Confirm a closed list, or mark it as information only.

### IG-07 Environment and setting class: Partly standard

| Workbook Tab 3b (17) | Activity (16) | Figma S10 (11 + custom) |
|---|---|---|
| Home; Work; School / study space; Bus / street / commuting; Cinema / restaurant / mall / market; Meeting / classroom; Exam hall; Placement ward / clinical; Lab / workshop; Seminar room / tutorial; In bed; Online meeting, camera on; Caring for a child or dependant; Unfamiliar place / travelling; Waiting room; Social event / party; Gym / outdoors; Prayer / quiet room; Place of worship | home, work, school/library, lecture hall, exam hall, placement ward, lab, bus/transit, public venue, waiting room, in bed, online meeting, caring for a dependant, gym/outdoors, prayer/quiet room, place of worship | Home, School, Work, Public, Transit, Restaurant, Mall, Bus / train station, Place of worship, Prayer or quiet room, Somewhere else (+ custom tag, S90) |

**Gaps:**
1. **Three different lists.** The workbook is the authority, so it should be the standard list. Figma is missing 11 workbook contexts and splits "public" into four.
2. **Setting class per context isn't stated.** CX-1 needs to know which contexts count as "public, formal, observed or unfamiliar". Tab 3b implies it but has no class column. "Work (open-plan common)" is unclear: observed or not?
3. **Three different setting-class sets:**
   - CX-1 (Tab 10): public, formal, observed, unfamiliar;
   - MD-4 and Tab 3b's last row: public, formal, observed, caring;
   - PRD FR-M03-03 `public_filter`: public, formal, observed, caring.

   Confirm these differences are intended.
4. **"Somewhere else" and custom tags (S90)** have no setting class. What should the engine assume?

### IG-08 Who's around: Partly standard

Activity: alone, friends, family, colleagues, strangers. Figma: Alone, Family, Friends, Classmates, Colleagues, Strangers. The workbook has no list. No rule uses it directly, though "observed" (CX-1) and "someone else present" (caring, MD-4) may depend on it. Confirm the list, and whether it changes the setting class.

### IG-09 Time / transition: Not standard

- **Activity:** transition points: "start of shift, between lectures, end of day, etc." (open-ended).
- **Figma S10:** time pressure: No rush, Some time, Limited, Right now.

These are **two different ideas**, and no rule uses either. "Right now" also overlaps with timeline T0. Decide which idea is meant, and whether any rule should use it.

### IG-10 Available support: Partly standard

- **Activity:** can call, can use headphones, in-person help, quiet room bookable, none right now.
- **Figma:** Just me, Can call someone, Someone with me, Headphones / headset.

Rules only use headphones (Tabs 3a, 3b, 6c). Confirm the list, and whether it's single or multi-select (headphones and "can call" can both be true).

### IG-11 Sensitivity flags: Standard

Sound, Noise, Lights, Crowd, Smell, Temperature, Touch / texture, Visual clutter. Same in the workbook (Tab 3a), PRD, Activity and Figma S152. No action (Figma's label "Touch" vs "Touch / texture" is wording only).

### IG-12 Needs: Partly standard

- **Workbook Tab 6b (21 needs):** each with a backend name and the words the user sees.
- **Figma S11 (11 needs + "I just want support"):** Help me feel calmer; There's too much in my head; Help me say this; Help me start a task; Change how I'm doing this; I need someone to talk to; Make sense of today; Help me speak up for myself; Find stillness; Pray or do my practice; I'm grateful, I want to note it.
- **PRD US-M04-01.2:** "Every label maps to exactly one need code."
- **Gaps:**
  1. **Ten workbook needs have no Figma option:** Break it into steps; Decide what matters now; Stop or switch; Rest without guilt; Ask for help or an adjustment; Prepare for an event; Recover after an event; Learn what works for me; Start or end my day well; Feel connected to something bigger. (Get urgent help is covered by the Help button; see IG-20.) Are they in the MVP?
  2. **The words differ from Tab 6b's "What the user sees"**, e.g. Figma "Help me start a task" vs Tab 6b "I can't get going". Which wording is standard?
  3. **One need or several?** Figma says "Pick the closest one". Tab 11 says multi-select, and the Tab 9 worked example uses two needs.

### IG-13 "I just want support": Standard

Figma S11 and PRD US-M04-01 agree: it skips the task step (a support-only journey, Tab 8 step 6). It isn't a Tab 6b row, which is fine.

### IG-14 Kind of task: Not standard

Figma S12 offers Study, Work, Health, Social, Home & other. The workbook and PRD have no such list, and no rule uses it. Confirm it as information only.

### IG-15 Number of tasks: Partly standard

- **Workbook:** Tab 11 layer 6: "None, one, or several activities". Tab 6 and Tab 7 pattern 22: two or more → sort the list, pick one.
- **Activity** (Process 7, step 7): several → narrow to one.
- **PRD FR-M04-02:** "one demand per run".
- **Figma S12:** "One task at a time".
- **Gap:** does the engine ever receive several tasks (so pattern 22 runs), or does the app narrow to one first (so pattern 22 only runs from the "Decide what matters now" need)?

### IG-16 Timeline: Partly standard

- **Standard:** the codes and labels T0–T6, TX and TR (Tab 4, PRD, Activity, Figma S12).
- **Gaps:**
  1. **Urgency weights** are words only: "maximum", "high", "moderate", "low", "inactive". Activity says each code has "an urgency weight". Provide the numbers, or confirm that only the order matters.
  2. **Step caps:**
     - only T0 (1–3) and T1 (3–5) have numbers;
     - T2 is "fuller";
     - T3–T6, TX and TR have none.
  3. **TR (recurring):** "The engine uses the NEXT occurrence to set T0–T5". No input carries the next due time.
  4. Tab 4 says the backend works out the code from a due date ("users never have to pick a code"). Figma S12 has the user pick a label. Which is it?

### IG-17 Demand characteristics: Not standard

- **Workbook Tab 6:** 18 characteristics, each with "How to detect it" in prose (e.g. "User indicates 'first time'…", "Timeline = T0/T1/T2 AND user indicates a consequence for delay").
- **Figma:** only "I've been putting this off" is a control (S12). S92 shows detected chips "Time pressure" and "Needs focus". "Needs focus" isn't a Tab 6 characteristic; it's used by Tab 7 pattern 13.
- **Gaps:**
  1. Agree standard values for the 18 characteristics, plus "needs focus".
  2. **Who sets each one:** the user (a toggle), the free-text tool (E-04), or history ("logged 3+ times without starting")? This is the interface with the other team.
  3. "Consequence for delay" needs an input that no screen collects.

### IG-18 Stored interests and values: Not standard

Tab 6 ("cross-reference with user's stored interests") and Tab 11 layer 7 ("stored interests and values") refer to a profile field that no source defines. Already deferred (ADR 0001). Confirm it's out of the MVP.

### IG-19 Entry route: Standard

"Check in" or "I need help with…" (Tab 8 step 1, Tab 11 layer 1, Figma S05). No action.

### IG-20 Immediate-risk inputs: Not standard (Clinical Safety)

- **Workbook:** SF-1: "Immediate risk language (selected option or free-text flag)". Tab 2: hopelessness, not wanting to be here, self-harm thoughts. Tab 6b: the "Get urgent help" need.
- **Figma:** a Help button on every screen; a "Hopeless" chip (S07).
- **Gaps:**
  1. **Which selectable options count as a "selected option"** for SF-1: the Hopeless chip, a Help tap, a dedicated "I need help now" option? (Related: CONFLICTS D-07; ADR 0001 §7 interim.)
  2. **The free-text risk flag comes from outside the engine** (E-04). The flag's form needs agreeing: a yes/no, the matched category, and the lexicon version used. See OWNER_DISCUSSION O-03.

### IG-21 System signals: Partly standard

Values the system already holds, used by the rules:

| Signal | Rule | Gap |
|---|---|---|
| Declines this session | Pattern 30 (3+) | "Session" isn't defined (time? leaving the card?) |
| Recently rejected suggestions | Tab 7 non-negotiable | "Immediately" isn't defined (this card? this session?) |
| Same topic reflected 3+ times in 7 days | RF-2 | "Topic" has no value list |
| Recurring struggle (3+ in 14 days) | Pattern 34 | "Same emotion family, context or avoided task": which counts? |
| Safety event recently | ENT-3 | No time window given |
| During a session | ENT-3 | Not defined |
| Recovery window open | RC-1/RC-2 (45 min) | Standard |
| Saved practices: due now, type, opening/closing | Patterns 37, 39 | Fields not defined in the workbook |
| "Meditation makes me feel worse"; body scan opt-in | MD-2 | Where the user sets these isn't defined |
| Plan (Free, Plus, institution) | Tab 6d | Standard |
| Trusted contact saved | Pattern 28 | Standard |
| Region | Pattern 28 crisis routes | UK only today; confirm for the MVP |

### IG-22 Feedback and re-check: Partly standard

- **Workbook / Activity:** "Did this help? (yes / a bit / no)" and "effort" (no scale). Re-check re-runs state *and* experience (Tab 8 step 11). RC-1 "improved" = a better cell, *or* intensity down by 2+.
- **Figma S25:** helpful 1–5; effort None / Slight / A lot / Max; the re-check asks **energy and mood only**.
- **Gaps:**
  1. Which scales are standard? (Related: CONFLICTS D-26.)
  2. **The Figma re-check doesn't ask about feelings,** so RC-1's "intensity down by 2+" can't be measured. Either the re-check also asks feelings, or RC-1 uses the cell only.
  3. **"Support completed"** (RC-1) isn't defined: finished the session? a minimum time? the user said it helped?
