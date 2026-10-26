**NUCCESS**

Product Requirements (PRD), Functional Requirements (FRD), User Stories by Module and Scrum Sprint Plan

Version 3.1 · October 2026 · Owner: Founder / Product Owner (Figcit) · Status: for team review

Built against: NUCCESS Recommendation Rules Engine v3.3 (the authority for all rules), NUCCESS Architecture & Screen Specification v3.1 and Figcit NUCCESS Activity Tables v2.1.

  

|  |
| :-: |
| **New in v3.1 — Free and Advanced tools, Sign-in**• Every support pathway now has **free tools** and **Advanced (paid) tools**. The free tools in each pathway form a safety floor that is always available; Advanced tools add depth, content, personalisation and AI/human companionship (section 1.9, rules ENT-1–ENT-9). This replaces the earlier statement that all support pathways are free.• New screen S41 Plans & Advanced Tools; returning-user Sign in added to S04 (US-M01-05). 14 new stories, including one Free/Advanced story for each pathway.**What changed from v2.0 (v3.0)**• Eight support pathways: Regulate, Express, Execute, Dump, Adapt, Reflect, Connect, Meditate · Rituals · Prayer. Reflect and Meditate are new modules (M11, M12) with their own screens, stories and safety gates.• Demand drivers renamed and re-scoped to **NUCRIPCE**: Novelty, Urgency, Challenge, Routine, Interest, Passion, Collaboration, Exploration (replaces NUCRRIPS; 'Socialisation' is now Collaboration, and contact needs belong to Connect).• Mood axis corrected to Very Bad, Bad, Neutral, Good (no 'Very Good'). The v2.0 state table in 8.1 is replaced.• Screens re-baselined to the v3 map S01–S40; old-to-new mapping is in the Architecture Specification section 12.• Requirements, stories and child issues are now organised by **module (M01–M19)**, so each squad or sprint can pick up a module end to end. |

  

  

# **0. How to use this document**

This document is written so that a designer or developer joining the team can open any module and know what to build, why, and when it is finished.

|  |  |  |
| :-: | :-: | :-: |
| **If you are…** | **Start with** | **Then** |
| Product designer | Section 1 (plain-language glossary), section 4 (screens) and section 3 (flows) | Your module in section 10. Every story has [Design] child issues with what 'done' means. |
| Front-end developer | Section 4 (screens) and section 6 (FRD for your module) | [FE] child issues in section 10; acceptance criteria are your test list. |
| Back-end / engine developer | Section 2 (architecture), section 8 (engine rules) and the Rules Engine workbook | [BE] and [Data] child issues; QA fixtures in section 13. |
| QA | Section 13 and the workbook scenario tabs (0, 0b, 9, 10) | [QA] child issues in each story. |
| Clinical Safety / Ops | Sections 7.2, 8.4 and 15 | [Safety] and [Content] child issues. |

## **0.1 Naming conventions**

|  |  |  |
| :-: | :-: | :-: |
| **Item** | **Format** | **Example** |
| Module | M + two digits | M11 Reflect |
| Screen | S + two digits (v3 map) | S25 Reflect |
| Functional requirement | FR-module-number | FR-M11-02 |
| User story | US-module-number | US-M12-04 |
| Child issue | Story ID + .number + [Type] | US-M12-04.2 [BE] |
| Rule reference | Workbook tab / pattern / gate | Tab 7 pattern 40; RF-2; MD-2 |

Child issue types: **\[Design\]** UX/UI, **\[FE\]** front end, **\[BE\]** back end / engine, **\[Data\]** schema, config, seed or analytics, **\[Content\]** copy, audio or library content, **\[Safety\]** clinical or safety review, **\[QA\]** testing.

# **1. Product requirements (PRD)**

## **1.1 Product definition**

NUCCESS is a neuro-affirming support and productivity app for neurodivergent people. It reads a person's capacity right now (Energy × Mood), what they are experiencing, where they are and what they need, and offers **one** low-burden next step: a support pathway, a task step, or support followed by a task.

## **1.2 Product promise**

|  |
| :-: |
| “Tell us how you are and what you need — we'll suggest one thing that fits you right now, and never push you past what you can do.” |

## **1.3 Goals**

1.  Reduce the effort of starting: one recommendation, one primary button, plain language.
2.  Protect capacity: support comes before demand when capacity is constrained; safety always overrides.
3.  Cover the full range of support needs with eight pathways, including meaning-making (Reflect) and stillness, ritual and faith practice (Meditate · Rituals · Prayer).
4.  Respect autonomy, privacy and belief: user-chosen practices, private reflections, consent-based sharing.
5.  Learn what helps each person from their own feedback, without overriding safety rules.
6.  Support B2B deployment (education, workplace, public sector) with aggregate, consented insight only.
7.  Be financially sustainable through Advanced tools in every pathway and institution licences, without ever charging for safety or selling to someone under strain.

## **1.4 Non-goals**

  - NUCCESS does not diagnose, treat or replace clinical care, crisis services or faith leaders.
  - It does not choose religious or spiritual content for anyone; profile data never selects practices.
  - It does not gamify wellbeing: no streaks, scores or failure framing for reflection or practice.
  - It does not show institutions individual reflections, practices or free text.
  - It does not charge for safety, check-in, the engine, Help/SOS or a person's own faith practice, and it does not show upgrade prompts when someone is struggling.

## **1.5 Plain-language glossary**

|  |  |  |
| :-: | :-: | :-: |
| **Term** | **What it means for the team** | **What the user sees** |
| State (Capacity Matrix) | Energy (Very Low→High) × Mood (Very Bad→Good) = one of 16 cells, e.g. E2M1. | A name, icon and one-line meaning, e.g. 'Ground First 🌱'. Never the cell ID. |
| Experience | Up to 3 emotions with intensity 0–10, grouped into families (Tab 2). | Emotion chips and Mild / Moderate / High / Very High. |
| Context | Environment, social setting, time/transition, support, sensitivity flags. | Editable suggestions. |
| Need | What kind of support the person wants (Tab 6b). | Plain sentences such as 'Make sense of today'. |
| Demand | An activity the person has to or wants to do, with a timeline. | 'What do you need to do?' and 'When?' |
| Band / traffic light | Available (Green), Conditional (Yellow), Constrained (Amber), Very Constrained (Red), Recovery overlay (Blue). | Colour cue and wording only; band names are never shown. |
| Support pathway | One of eight kinds of support the engine can offer. | A card with one button. |
| NUCRIPCE | Eight demand drivers tagged on an activity. | Small indicators on task cards; never a form to fill in. |
| Timeline code | T0 Now … T6 No deadline, TX Overdue, TR Recurring. Urgency is derived from it. | Plain words like 'Later today'. |
| Gate | A safety rule that allows, limits or blocks a pathway (e.g. RF-2, MD-2). | A gentle alternative, never an error. |
| Free / Advanced tool | Every tool has a tier. Free tools work for everyone; Advanced tools need NUCCESS Plus or an institution licence. | Advanced tools carry an 'Advanced' label; hidden in Amber/Red. |
| Safety floor | The free tools in each pathway the engine can always use in any light (e.g. Breathe, Ground, Move, core Sounds). | Nothing — they just work. |
| Entitlement | What the user's plan unlocks (Free, Plus, concession, institution licence). | Plans & Advanced Tools screen (S41). |

## **1.6 The eight support pathways**

|  |  |  |
| :-: | :-: | :-: |
| **Pathway** | **User's question** | **Where offered** |
| Regulate | How can I feel, sense or function better right now? | All lights. Forced first in Amber/Red. |
| Express | I know what I mean but cannot get it into words or structure. | All lights (Regulate first in Red). |
| Execute | I have something to do but do not know how to start or continue. | Green, Yellow, Blue; Amber = Routine only; deferred in Red. |
| Dump | I have too much in my head and cannot organise or name it. | All lights. |
| Adapt | The current way of doing this is creating unnecessary friction. | All lights. |
| Reflect | Help me make sense of what happened, or what helps me. | Green, Blue; Yellow at Mild/Moderate. Amber: save for later. Red: not offered. |
| Connect | I feel isolated, or I want social or community contact. | All lights. |
| Meditate · Rituals · Prayer | Help me find stillness, or keep the practice that grounds me. | Green, Yellow, Blue; Amber when calm. Amber with distress: short eyes-open or saved practice as alternative. Red: user-initiated alternative only. |

## **1.7 Where Reflect and Meditate fit (decision)**

We tested whether Reflect or Meditate could sit inside an existing pathway. **Decision: keep both as separate pathways with their own gates.**

  - **Reflect** is closest to Dump and Express but different: Dump empties the head with no structure; Express makes words for someone else; Reflect is structured meaning-making for the person themselves, and it needs a rumination guard that the others do not.
  - **Meditate · Rituals · Prayer** overlaps with Regulate only for short breathing and grounding tools. Those micro-tools **stay in Regulate**. Longer practice, rituals and prayer are intentional, meaning- or faith-based and user-chosen, so they live in Meditate.
  - Adapt can call a saved ritual for transitions; Connect can offer faith or community groups the user has listed.
  - If a merge were ever forced, the least-bad fits would be Reflect → Express and Meditate → Regulate, but we would lose the dedicated safety gates, faith neutrality and the ability to measure each pathway.

## **1.8 Example scenarios that call for Reflect or Meditate**

|  |  |  |
| :-: | :-: | :-: |
| **State · experience · context** | **Need / demand** | **Result** |
| Full Flow (Green), relief after submitting an essay, at home | No demand; 'note what helped' | Reflect: What helped (pattern 33) |
| Ready to Try (Green), recurring struggle with Monday meetings, confirmed by user | Wants to understand the pattern | Reflect: Pattern review → save to My Patterns (34) |
| Flow Entering (Yellow, Moderate), adjustment meeting Thursday (T2) | Help me speak up | Reflect: Self-advocacy prep → Express (35) |
| Gentle Drift (Red), distress 8, 'make sense of today' | Wants to go over it | Reflect blocked → Dump or Regulate (40) |
| Full Flow (Green), anticipatory unease 5, interview at 2pm (T1) | Prepare for interview | Meditate: 5-min settle → Execute (36) |
| Creative Peak (Green), saved midday prayer due (TR), open-plan office | Do my practice | Adapt (quiet room) → Meditate: user's own prayer (37) |
| Tender Space (Amber), calm, end of day | Find stillness | Meditate: short stillness timer (38) |
| Ground First (Amber), shutdown, feeling detached | Find stillness | Meditate blocked as primary → Regulate (Ground/Move), eyes-open practice as alternative (41) |

Full set: Rules Engine v3.3 Tab 0b scenarios RF.1–RF.8, MD.1–MD.11 and GD.1–GD.3; patterns 33–41 in Tab 7.

## **1.9 Business model: Free and Advanced tools in every pathway**

NUCCESS earns revenue from **Advanced tools** (NUCCESS Plus subscription for individuals, and institution licences), not from charging for support itself. Every pathway has free tools; the free tools are also the **safety floor** the engine uses in Amber and Red. Advanced tools add depth (more content, longer programmes), personalisation and insight, and AI or human companionship.

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **Pathway** | **Free tools** | **Advanced tools (paid)** | **Safety floor** |
| Regulate | Breathe (core paced patterns, 1–5 min); Ground (5-4-3-2-1, feet on floor, cold-water cue); Move (shake-out, stretch, short walk prompt); Sounds (core set: brown/white noise, rain, quiet timer); Step out; Recovery/rest timer; discreet public variants; tap-only non-verbal mode. | Advanced Sounds (full soundscape library, personal mixer, offline downloads); Advanced Movement (sensory-diet and proprioceptive routines, guided movement videos, desk and commute routines); Create (drawing, colouring, rhythm and music-making, fidget canvas); Attention reset games; Sleep wind-down programmes; personal regulation toolkit ordered by what helped. | Breathe, Ground, Move, core Sounds, Step out, Rest — always free and always the tools the engine uses in Amber and Red. |
| Express | Simplify and Rewrite (fair-use daily allowance); communication cards ('I need a minute', non-speaking cards); ready templates for asking for help or a pause. | Draft from scratch; Structure long documents and emails; Scripts for meetings, calls and presentations; tone check ('how might this land?'); Simplify a resource (upload a letter or PDF); voice-to-structured message; send-later scheduling; unlimited use. | Communication cards and help templates are always free; no one is ever charged to say they need help. |
| Execute | Task list with 'why now'; smallest next step; basic breakdown (up to the timeline cap); pick-one-of-three; simple focus timer. | Full breakdown with editing and re-planning; AI body double; human body-double rooms; recurring routine builder; calendar sync; overdue repair assistant (message + re-plan). | Smallest next step and the timeline cap always free. |
| Dump | Unlimited text capture; voice capture (time allowance); manual sorting into Ideas, Notes, Worries, To-do; move an item to a task by hand. | AI sorting suggestions; photo and document capture with text recognition; search across all dumps; longer voice notes with transcription; one-tap convert to task, draft or reflection. | Text and voice capture always free. |
| Adapt | Adaptation library (environment, format, sequence, scope, pace, instructions, communication method); stop points; one-tap re-run of the recommendation. | Personal Adjustment Passport (what helps me at work or study, shareable); reasonable-adjustment request templates (drafted in Express); transition planner using saved rituals; context plans (workplace, exams, travel, events). | Adaptation library and stop points always free. |
| Reflect | 3-prompt check-out; gratitude note; end-of-day close; save takeaways to My Patterns (list view). | What helped insights; Pattern review with plain-language trend cards; Self-advocacy prep with hand-off to Express; monthly reflection summary; export reflections into a report. | Rumination guard and safety screening apply equally in both tiers; Reflect is never needed in Amber or Red. |
| Connect | Trusted contacts; one-tap pre-written messages; async messaging via the device; groups the user has listed (including faith or community groups). | Moderated peer community spaces; scheduled check-in buddy; human body-doubling rooms (shared with Execute); hosted group sessions. | Trusted contacts and one-tap messages always free. |
| Meditate · Rituals · Prayer | Stillness timer; guided settle (3 and 5 min); gratitude practice; eyes-open versions; the user's OWN rituals, prayers, recitations, schedules and reminders (unlimited); 'In worship' mode. | Full guided library (10 and 20 min, walking practice, body-scan series); multi-step ritual builder with audio and timers; recitation player (loops, offline, own audio upload); themed programmes (exam season, transitions, sleep); practice insights. | Short eyes-open settle and the user's own practices are always free. Nobody pays to keep their own faith practice. |

### **Cross-cutting features**

|  |  |  |
| :-: | :-: | :-: |
| **Feature area** | **Free** | **Advanced** |
| Onboarding, check-in, experience, context, need, demand | All free | — |
| Engine and Recommendation Card | All free (same rules for every user) | Advanced tools may appear as ONE labelled alternative in Green, Yellow or Blue |
| Help/SOS, safety override, Support Plan | Always free; no account needed for Help/SOS | — |
| Feedback, re-check, Blue Recovery, basic personalisation | Free | — |
| Progress (S33) | Last 30 days, text summaries | Full history, cross-pathway insights, downloadable charts |
| Report & Sharing (S34) | One simple summary shared with a named person | Detailed reports, scheduled reports, multiple recipients |
| Accessibility settings, consent, export, delete | Always free | — |

### **How the split was decided**

  - **Free** = what someone needs to get through a hard moment or start a task: the core tool in each pathway, everything safety-related, and anything that lets a person communicate a need.
  - **Advanced** = what adds depth once someone is steady: bigger content libraries (soundscapes, movement routines, guided programmes), creative tools (Create), AI that does heavier work (drafting, document simplification, AI sorting, AI body double), human services that cost money to run (body-double rooms, moderated peer spaces), and insight over time.
  - Applied to Regulate as the founder specified: Breathe, Sounds and Move are free; Advanced Sounds, Advanced Movement and Create are paid.
  - Never paid: Help/SOS, safety override, check-in, engine and card, Support Plan, communication cards, accessibility settings, export and delete, and the user's own rituals and prayers.

### **Entitlement rules**

|  |  |
| :-: | :-: |
| **Rule** | **Rule in plain words** |
| ENT-1 | Free floor: every pathway has free tools that work in every light and setting. The engine's primary action is always something the user can open with their current plan. |
| ENT-2 | Safety and access are never paid: check-in, the engine, the card, Help/SOS, the safety override, the Support Plan, communication cards, accessibility settings, export and delete. |
| ENT-3 | No upselling under strain: no Advanced tiles, upgrade prompts or paywalls in Amber or Red, when any negative intensity is High or Very High, after a safety event, or during a session. In Green, Yellow or Blue at most ONE Advanced alternative is shown, labelled 'Advanced', never as the primary, and dismissing it is remembered. |
| ENT-4 | Faith practice is never paid: the user's own prayers, rituals, schedules and reminders are free. Only Nuccess-produced guided content is Advanced. Belief data is never used to sell anything (MD-3). |
| ENT-5 | Same safety rules in every plan: RF and MD gates, bands and guards apply equally; paying never unlocks a blocked pathway. |
| ENT-6 | Lapse keeps data: if a subscription ends, the user's content stays readable and exportable; Advanced tools become locked, nothing is deleted. |
| ENT-7 | Institution licences unlock Advanced for covered users; paying institutions get no extra access to individual data. |
| ENT-8 | Honest pricing: clear price before purchase, cancel in two taps, no countdown pressure or guilt copy; purchases only by adults; under-18s only through an approved institution licence. |
| ENT-9 | Tier changes are configuration: moving a tool between Free and Advanced needs PO approval, plus Safety Reviewer approval for anything in Regulate, Connect, communication cards or the safety floor. |

### **Plans**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **Plan** | **Who** | **Includes** | **Price** |
| Free | Everyone, with or without an account (Browse mode has no saved history) | All free tools in all eight pathways, the full engine, Help/SOS, Support Plan, 30-day progress | £0 |
| NUCCESS Plus (individual) | Adults who want Advanced tools | Everything in Free + Advanced tools in all eight pathways, full progress and reports | Monthly and annual price — to be set in the financial plan (TBC) |
| Plus concession | Students and people on a low income (eligibility TBC) | Same as Plus | Reduced price (TBC) |
| Institution licence | Universities, colleges, employers, public sector | Plus for covered users + CAAM dashboard (aggregate, consented) | Per-seat or per-site licence (TBC) |

Prices, trial length and concession eligibility are decisions for the financial plan and must be held as configuration (US-M17-06).

# **2. Product architecture**

The deterministic engine (M04) is the heart of the product. AI is used only for language tasks (Dump sorting, Express drafting, task breakdown, need classification) behind a service layer with fallbacks. Safety rules and gates never depend on AI.

## **2.1 Core entities**

|  |  |  |
| :-: | :-: | :-: |
| **Entity** | **Key fields** | **Module** |
| CheckIn | energy, mood, cell_id, source (grid / body_check), rules_version, timestamp | M02 |
| Experience / Sensation / Context | emotion, family, intensity; sensation flags (shutdown, detached, overload_level); environment, public_filter, sensitivity flags | M03 |
| Need / Demand | need_code; demand text, timeline_code, recurring_rule, avoidance_flag, NUCRIPCE tags | M04 |
| Recommendation | band, light, modifiers, patterns fired, gates applied, primary, alternatives, rationale, rules_version | M04 |
| Session / Feedback | module, tool, length, completed, helped, effort, recheck_cell | M05–M13 |
| ReflectionEntry (NEW) | variant, answers, takeaway, topic_tag, saved, safety_flag | M11 |
| Practice / PracticeSession (NEW) | type (meditate / ritual / prayer), source (user / library), steps, media, schedule (TR), eyes_open, public_safe; session length, completed, context | M12 |
| UserPracticeFlags (NEW) | helps_when_struggling, makes_me_worse, in_worship_mode | M12 |
| Consent / AuditLog | purpose, scope, granted_at, withdrawn_at; actor, action, object, time | M16, M19 |
| ToolCatalogue (NEW v3.1) | tool_id, pathway, tier (free / advanced), safety_floor, public_safe, eyes_open, config_version | M04, M17 |
| Plan / Entitlement / BillingEvent (NEW v3.1) | plan, source (store / web / institution), status (trial / active / grace / lapsed / cancelled), renews_at; billing events with provider reference — no card data | M16, M19 |

# **3. User flows**

**Main flow:** Home → Check-in (S06/S07) → Experience (S08) → Sensations (S09, optional) → Context (S10) → Need (S11) → Demand & Timeline (S12, optional) → Engine → Recommendation Card (S13) → Pathway or task → Feedback & Re-check (S30) → Blue Recovery / next step / Home.

**Support-only flow:** any entry → Need ('I just want support') → Engine → pathway → Feedback. No task or NUCRIPCE needed.

**Sign-in flow:** S04 Sign in → email/password, passkey, social or institution SSO → verify (MFA for staff) → restore preferences, support plan, practices and entitlement → sync offline data → Home (customers) or role dashboard (staff). Full steps: Activity Tables Process 2.

**Upgrade flow:** only when steady (Green, Yellow at Mild/Moderate, Blue): Advanced tile → S41 Plans & Advanced Tools → purchase via app store or web → entitlement unlocks Advanced tools → back to the tool. 'Not now' is always equal. Full steps: Activity Tables Process 11.

**Safety:** the safety override can interrupt any step and open Help/SOS (S31), which is reachable from every screen.

## **3.1 Route per pathway**

|  |  |  |
| :-: | :-: | :-: |
| **Pathway** | **Screens** | **Typical exit** |
| Regulate | S14 → S15 | S30, then queued task or Home |
| Dump | S16 → S17 (optional) | Home, or send to Execute / Express / Reflect |
| Express | S18 → S19 | Copy / save; optional Execute |
| Execute | S20 → S21 → S22 | S30 |
| Adapt | S23 | Re-run S13 (or S28 for a saved ritual) |
| Connect | S24 | External app, then S30 |
| Reflect | S25 → S26 (optional save) | S30, or hand-off to S19 Express / S23 Adapt |
| Meditate · Rituals · Prayer | S27 → S28 (S29 to set up) | S30 |

# **4. Screen inventory (S01–S41)**

Source: Architecture & Screen Specification v3.0. Screens marked NEW were added for Reflect and Meditate (v3.0) and for plans (S41, v3.1).

|  |  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **ID** | **Screen** | **Module** | **Purpose** | **Key elements** | **Primary action** | **Next** |
| S01 | Welcome | M01 | Calm, low-pressure first impression | Purpose in one line; privacy promise; accessibility shortcut; See how it works; Skip | Get started / Skip | S02 or S04 |
| S02 | Journey Map | M01 | Show how Nuccess works without cognitive load | Check in → Support → Match → Act → Feedback; optional explanations; Skip | Continue / Skip | S03 |
| S03 | Quick Setup | M01 | Make it comfortable from the first session | Text size, font, contrast/theme, motion, sound, haptics, language, notification style; calm defaults | Save / Skip | S04 |
| S04 | Enter Your Space | M01 | Low-friction entry | Sign in (returning users); Sign up (email/auth); Register full profile (optional fields, nothing mandatory beyond login); Browse without an account | Enter / Skip | S05 |
| S05 | Home / Now | M01 | Calm daily launch point | Current state name + icon; one next action; Check in; 'I need help with something'; quick Dump; one-tap Regulate; Help/SOS always visible | Choose action | S06 or module |
| S06 | Check-in: Capacity Matrix | M02 | Capture Energy × Mood as one coupled state | Energy (Very Low→High) and Mood (Very Bad→Good) as two taps or one grid tap; result = state name, icon, one-line meaning; 'Not sure' link. Never shows cell IDs, band names or the grid label | Select | S08 (or S07) |
| S07 | Not sure — body check | M02 | Work for people who can't name how they feel | 3 picture-based taps (body, energy, comfort) → 'Does this sound like you?' suggested state to confirm | Confirm / Pick anyway | S08 |
| S08 | Emotions & Intensity | M03 | Capture lived experience separate from Mood | Emotion chips with emoji (up to 3) + custom; intensity per emotion 0-10 with plain labels (Mild/Moderate/High/Very High); Skip | Next / Skip | S09 |
| S09 | Sensations & Body Map | M03 | Optional detail that shapes which tools fit | Six categories: Sensory, Cognitive, Body (incl. pain with its own intensity), Communication, Movement, Interoception (hunger, thirst, toilet, sleepiness, too hot/cold); tappable body map | Next / Skip | S10 |
| S10 | Context & Sensitivity | M03 | Capture where and under what conditions | Environment, social setting, time/transition, available support; sensitivity flags (Sound, Noise, Lights, Crowd, Smell, Temperature, Touch, Visual clutter); editable suggestions | Confirm / Edit | S11 |
| S11 | Need | M04 | Identify what support is wanted | Plain-language needs list (e.g. Help me feel calmer, There's too much in my head, Help me say this, Find stillness, Make sense of today, Pray or do my practice); text/voice; 'I just want support' | Continue | S12 or S13 |
| S12 | Demand & Timeline | M04 | Optional activity and when it's due | One or more activities; timeline in plain words (Now … No deadline, Overdue, Recurring); 'I've been putting this off' toggle; pick ONE if several | Continue / Skip | S13 |
| S13 | Recommendation Card | M04 | One clear, low-burden next step | State name + icon; traffic light; ONE primary CTA (always a tool the user's plan includes — ENT-1); up to 2 alternatives (max one labelled Advanced, Green/Yellow/Blue only); 'Because …, Nuccess suggests …' rationale; Not now; Get support now when Red | Start / Try another / Not now | Pathway module |
| S14 | Regulate Home | M05 | Choose a regulation tool | Breathe, Ground, Move, Sounds, Create, Step out, Recovery/rest, Sleep wind-down; tools filtered by context; discreet variants first in public; Free and Advanced tools (Advanced labelled; locked tiles hidden in Amber/Red — ENT-3) | Choose tool | S15 |
| S15 | Regulate Session | M05 | Run one tool | Visual pacer / audio / steps; tap-only non-verbal mode; length options; stop anytime | Start / Stop | S30 |
| S16 | Dump Capture | M06 | Get it out fast | Text, voice, photo/upload; no categories required; autosave; Free and Advanced tools (Advanced labelled; locked tiles hidden in Amber/Red — ENT-3) | Capture | S17 or Home |
| S17 | Dump Review | M06 | Optional sorting after capture | Suggested buckets (Ideas, Notes, Worries, To-do), editable; send onwards only on the user's choice | Save / Send / Discard | Home / S20 / S18 / S25 |
| S18 | Express Home | M07 | Choose communication help | Draft, rewrite, simplify, structure, script, alternative communication; simplify a resource; Free and Advanced tools (Advanced labelled; locked tiles hidden in Amber/Red — ENT-3) | Choose | S19 |
| S19 | Express Workspace | M07 | User-controlled output | Editable output; meaning preserved; edits explained; copy/save/export; never auto-sends; 'send later' cooling-off option | Edit / Save / Copy | Home / S20 |
| S20 | Task List | M08 | Demand management | Task cards with timeline and demand indicators; state-aware order with 'why now'; add task (type/speak); pick-one-of-three view; Free and Advanced tools (Advanced labelled; locked tiles hidden in Amber/Red — ENT-3) | Open / Add | S21 |
| S21 | Task Detail & Break Down | M08 | Reduce initiation load | Smallest step; editable steps capped by timeline; Adapt options; overdue repair helper | Break down / Start | S22 |
| S22 | Focus Session & Body Double | M08 | Do one step | One active micro-step; optional timer; AI or human body double; pause / adapt / complete; Free and Advanced tools (Advanced labelled; locked tiles hidden in Amber/Red — ENT-3) | Start / Complete / Adapt | S30 |
| S23 | Adapt | M09 | Change the conditions, not the person | Environment, format, sequence, scope, pace, instructions, communication method; stop point; transition (can use a saved ritual); Free and Advanced tools (Advanced labelled; locked tiles hidden in Amber/Red — ENT-3) | Choose adaptation | Re-run S13 |
| S24 | Connect | M10 | Social connection on the user's terms | Trusted contacts; async/text default; one-tap pre-written messages; peer, community or faith groups the user has listed; Free and Advanced tools (Advanced labelled; locked tiles hidden in Amber/Red — ENT-3) | Choose | External / S30 |
| S25 | Reflect | M11 | Make sense of an experience (NEW) | 3 guided prompts as chips, voice or short text; timer visible; stop anytime; one takeaway; save to My Patterns (optional); hand-off to Express/Adapt; Free and Advanced tools (Advanced labelled; locked tiles hidden in Amber/Red — ENT-3) | Start / Save / Skip | S30 / S19 / S23 |
| S26 | My Patterns | M11 | The user's own reflections and patterns (NEW) | Saved reflections; 'what helps me' list; pattern cards in plain words; delete; pattern prompts on/off | View / Delete | Home |
| S27 | Meditate · Rituals · Prayer | M12 | Choose a practice (NEW) | Three tabs: Meditate (stillness, guided settle, gratitude, walking), Rituals (user's opening/closing/transition rituals), Prayer (user's own schedule, texts or audio); length picker; context-safe variants; Free and Advanced tools (Advanced labelled; locked tiles hidden in Amber/Red — ENT-3) | Choose practice | S28 |
| S28 | Practice Session | M12 | Run one practice (NEW) | Timer or guided audio; eyes-open variant; 'In practice' mode pauses notifications; stop anytime | Begin / End | S30 |
| S29 | My Practices | M12 | Set up personal practices (NEW) | Add own ritual (steps), prayer or recitation (text/audio/link), schedule (TR), reminder style, 'helps me when I'm struggling' flag, 'meditation makes me feel worse' flag | Save | S27 |
| S30 | Feedback & Re-check | M13 | Measure helpfulness and state change | Did this help? (yes / a bit / no); effort; optional re-check; Blue Recovery message; queued next step | Submit / Skip | S13 / Home |
| S31 | Help / SOS | M14 | Human support pathway (Safety screen) | Fixed, clinically reviewed copy; 999, NHS 111 mental health option, Samaritans 116 123, Shout 85258; trusted contact; institution/GP routes | Choose support | External |
| S32 | Support Plan | M14 | Preferred contacts and routes | Trusted contacts; preferred routes; pre-written messages; consent for each | Save | S31 / S36 |
| S33 | Progress Dashboard | M15 | Understand own patterns | State trends; pathways used and what helped; tasks completed; accessible charts + text; no clinical interpretation | View | Home |
| S34 | Report & Sharing | M15 | Communicate needs while keeping control | Choose date range and records; accessible report; share with a named professional; revoke | Generate / Share | S33 |
| S35 | Reminders & Notifications | M16 | Control prompts | Reminders (tasks, practices); quiet hours; 'In worship' / do-not-disturb; notification style | Save | Home |
| S36 | Settings & Privacy | M16 | Control experience and data | Accessibility; consent per data use; institutional sharing; export; delete; age and safeguarding notice | Save | Home |
| S37 | Admin Console | M17 | Configure and monitor (internal) | Rule and content configuration with draft/review/approve; aggregate analytics; safety and AI monitoring; audit | Filter / Approve | Role-specific |
| S38 | Institution Dashboard (CAAM) | M18 | Aggregate, consented insight for institutions | Aggregate trends by team/department; minimum cohort size; no individual data without consent; Reflect and practice data never shown | Filter | S39 |
| S39 | Institution User Summary | M18 | Consent-scoped support | Only for users who opted in; trends/flags only; outreach request; access logged | Request outreach | Audit |
| S40 | Log Out | M16 | End session safely | Confirm; data saved | Log out / Cancel | S01 |
| S41 | Plans & Advanced Tools | M16 | Choose or manage a plan (NEW v3.3) | Free vs Advanced per pathway in plain words; price; trial (if any); institution licence status; cancel in two taps; never shown in Amber/Red or during a session | Upgrade / Manage / Not now | Previous screen |

## **4.1 Design rules for every screen**

  - One primary button per screen. Alternatives are visually quieter.
  - Skip, Not now and Stop are always available and never penalised.
  - Help/SOS is visible on every screen.
  - Never show cell IDs, band names, pathway or intervention jargon, or the word 'grid'.
  - Respect user settings: text size, contrast, motion, sound and haptics.
  - No streaks, scores or failure messages — especially for Reflect and practices.
  - Advanced tools carry a text label 'Advanced'; locks, prices and upgrade prompts never appear in Amber, Red, at High+ intensity or mid-session.
  - Plain-language copy; icons always have text labels.

# **5. Modules (epics)**

Each module is one epic. Stories and child issues in section 10 are grouped by these modules.

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| **Module** | **Name** | **Screens** | **Scope** | **Stories** |
| M01 | Onboarding, Accounts & Home | S01–S05 | First-run experience, account creation and the calm Home screen. | 5 |
| M02 | Check-in: Capacity Matrix | S06–S07 | Energy × Mood check-in and the 'Not sure' body check. | 3 |
| M03 | Experience & Context | S08–S10 | Emotions, sensations, context and sensitivity flags. | 3 |
| M04 | Need, Demand & Recommendation Engine | S11–S13 + engine service | Need, demand, timeline, the deterministic engine (bands, patterns, gates, NUCRIPCE) and the recommendation card. | 8 |
| M05 | Regulate | S14–S15 | Short body-first regulation tools. | 3 |
| M06 | Dump | S16–S17 | Fast capture with optional sorting. | 3 |
| M07 | Express | S18–S19 | Help with words and structure. | 3 |
| M08 | Execute (Tasks, Focus, Body Double) | S20–S22 | Tasks, breakdown, focus and body doubling. | 4 |
| M09 | Adapt | S23 | Changing conditions rather than the person. | 3 |
| M10 | Connect | S24 | Contact with people and groups on the user's terms. | 3 |
| M11 | Reflect (NEW) | S25–S26 | Guided, time-limited reflection and My Patterns. | 6 |
| M12 | Meditate · Rituals · Prayer (NEW) | S27–S29 | Meditation, the user's own rituals and prayer, with a neutral library. | 8 |
| M13 | Feedback, Recovery & Personalisation | S30 | Feedback, re-check, Blue Recovery and personalisation. | 3 |
| M14 | Safety & Support | S31–S32 | Help/SOS, safety override and support plan. | 3 |
| M15 | Progress, Reports & Sharing | S33–S34 | Progress dashboard, reports and sharing. | 4 |
| M16 | Settings, Privacy, Consent, Notifications & Plans | S35, S36, S40, S41 | Settings, consent, notifications, export/delete, log out, Plans & Advanced Tools (S41). | 4 |
| M17 | Admin Console & Rules Configuration | S37 | Admin console, rules/content configuration and monitoring. | 6 |
| M18 | Institution (CAAM) | S38–S39 | Institution dashboard and consent-scoped summaries. | 3 |
| M19 | Platform, Integrations, Security & Data | Backend, all screens | Platform, auth, data, analytics pipeline, AI layer and integrations. | 7 |

# **6. Functional requirements (FRD) by module**

Priority uses MoSCoW (Must, Should, Could). 'Rules' points to the Rules Engine v3.3 tab, pattern or gate that is the source of truth.

### **M01 — Onboarding, Accounts & Home**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M01-01 | Show a skippable welcome and journey map; no account required to view. | Must | — |
| FR-M01-02 | Let returning users sign in by email/password, passkey, social login or institution SSO; restore preferences, support plan, practices and entitlement before Home; lockout and reset rules; MFA for staff. | Must | NFR-04 |
| FR-M01-03 | Capture accessibility preferences before sign-up and sync them after. | Must | NFR-01 |
| FR-M01-04 | Offer sign up, full registration (optional fields) and browse without an account; sensitive fields never mandatory. | Must | — |
| FR-M01-05 | Home shows current state name/icon, one next action and Help/SOS. | Must | Tab 8 |

### **M02 — Check-in: Capacity Matrix**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M02-01 | Capture Energy (4 levels) and Mood (Very Bad, Bad, Neutral, Good) as one coupled state of 16 cells. | Must | Tab 1 |
| FR-M02-02 | Show the approved state name, icon and meaning; never cell IDs or band names. | Must | Tab 1 |
| FR-M02-03 | Offer a 3-question picture-based 'Not sure' check that suggests a state for confirmation. | Must | Tab 1 |

### **M03 — Experience & Context**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M03-01 | Capture up to 3 emotions with intensity 0–10 and resolve each to a family, including the eight v3.2 families. | Must | Tab 2 |
| FR-M03-02 | Capture sensations including shutdown, detached/unreal and sensory overload level as engine flags. | Should | Tab 3, MD-2 |
| FR-M03-03 | Capture context and sensitivity flags; compute public_filter (public, formal, observed, caring) and sensitivity count. | Must | Tab 3, 3b |

### **M04 — Need, Demand & Recommendation Engine**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M04-01 | Offer a plain-language needs list including v3.2 needs (make sense, speak up, stillness, practice, gratitude). | Must | Tab 6b |
| FR-M04-02 | Capture an optional demand with a timeline code T0–T6, TX or TR; derive Urgency; one demand per run. | Must | Tab 4 |
| FR-M04-03 | Calculate band and light with EX-1, CX-1, CAP-1, UP-0 and DEM-0. | Must | Tab 10 |
| FR-M04-04 | Select one primary pathway and up to two alternatives from eight pathways using patterns 1–41. | Must | Tab 7 |
| FR-M04-05 | Apply gates RF-1 to RF-5 and MD-1 to MD-6 after pattern matching, with the Tab 7 fallbacks. | Must | Tab 6c |
| FR-M04-06 | Tag demand with NUCRIPCE; cap to Routine in Amber; defer in Red. | Must | Tab 6 |
| FR-M04-07 | Show one recommendation card with rationale; Not now, Try another; Get support now in Red; Save for later for Reflect in Amber. | Must | Tab 8, 9 |
| FR-M04-08 | Store every recommendation with inputs, rules fired and versions. | Must | NFR-07 |
| FR-M04-09 | Apply the entitlement filter after gates: primary always within the user's plan; at most one labelled Advanced alternative in Green/Yellow/Blue; none in Amber/Red, at High+ intensity, after a safety event or mid-session. | Must | Tab 6d, ENT-1–ENT-3 |

### **M05 — Regulate**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M05-01 | Provide the free Regulate tools and the Advanced Regulate tools listed in Tab 6d; free tools listed first; Advanced labelled and gated by entitlement. | Must | Tab 6d |
| FR-M05-02 | Offer regulation tools filtered by context, with discreet variants first in public. | Must | Tab 3b |
| FR-M05-03 | Run sessions with stop anytime; shorten to 1–2 min at T0, never skip. | Must | Tab 4 |

### **M06 — Dump**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M06-01 | Provide the free Dump tools and the Advanced Dump tools listed in Tab 6d; free tools listed first; Advanced labelled and gated by entitlement. | Must | Tab 6d |
| FR-M06-02 | Capture text, voice or photo with autosave and no required sorting. | Must | Tab 7 |
| FR-M06-03 | Suggest editable buckets; send onwards only on user choice; Reflect send-to only when gates allow. | Should | RF-1, RF-2 |

### **M07 — Express**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M07-01 | Provide the free Express tools and the Advanced Express tools listed in Tab 6d; free tools listed first; Advanced labelled and gated by entitlement. | Must | Tab 6d |
| FR-M07-02 | Draft, rewrite, simplify, structure and script with editable output; never auto-send. | Must | Tab 7 |
| FR-M07-03 | Support send-later and pre-fill from Reflect self-advocacy prep. | Should | Pattern 35 |

### **M08 — Execute (Tasks, Focus, Body Double)**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M08-01 | Provide the free Execute tools and the Advanced Execute tools listed in Tab 6d; free tools listed first; Advanced labelled and gated by entitlement. | Must | Tab 6d |
| FR-M08-02 | Order tasks by band, NUCRIPCE and timeline with a 'why now'. | Must | Tab 6, 7 |
| FR-M08-03 | Break tasks into steps capped by timeline; overdue repair first. | Must | Tab 4 |
| FR-M08-04 | Provide focus sessions with an AI or human body double. | Should | Tab 4 |

### **M09 — Adapt**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M09-01 | Provide the free Adapt tools and the Advanced Adapt tools listed in Tab 6d; free tools listed first; Advanced labelled and gated by entitlement. | Must | Tab 6d |
| FR-M09-02 | Offer environment, format, sequence, scope, pace, instruction and communication adaptations and re-run the engine. | Must | Tab 7 |
| FR-M09-03 | Offer the user's saved transition ritual from M12. | Should | Pattern 37 |

### **M10 — Connect**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M10-01 | Provide the free Connect tools and the Advanced Connect tools listed in Tab 6d; free tools listed first; Advanced labelled and gated by entitlement. | Must | Tab 6d |
| FR-M10-02 | Offer trusted contacts, async messages and one-tap templates; not primary in social hangover. | Must | Tab 7 |
| FR-M10-03 | Show community or faith groups only if the user added them. | Could | MD-3 |

### **M11 — Reflect (NEW)**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M11-01 | Provide the free Reflect tools and the Advanced Reflect tools listed in Tab 6d; free tools listed first; Advanced labelled and gated by entitlement. | Must | Tab 6d |
| FR-M11-02 | Run Reflect sessions of exactly three prompts with a visible timer, chips/voice/text and one takeaway. | Must | RF-3 |
| FR-M11-03 | Offer Reflect only per RF-1; Amber shows Save for later; Red never offers it. | Must | RF-1 |
| FR-M11-04 | Block Reflect when the rumination guard fires and route to Dump or Regulate. | Must | RF-2, pattern 40 |
| FR-M11-05 | Keep reflections private, deletable and out of institution views. | Must | RF-4 |
| FR-M11-06 | Screen all Reflect text with the safety classifier. | Must | RF-5 |
| FR-M11-07 | Provide My Patterns with saved reflections, 'what helps me' and plain-language pattern cards. | Should | Pattern 34 |
| FR-M11-08 | Hand off from Reflect to Express or Adapt. | Should | Pattern 35 |

### **M12 — Meditate · Rituals · Prayer (NEW)**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M12-01 | Provide the free Meditate · Rituals · Prayer tools and the Advanced Meditate · Rituals · Prayer tools listed in Tab 6d; free tools listed first; Advanced labelled and gated by entitlement. | Must | Tab 6d |
| FR-M12-02 | Provide Meditate, Rituals and Prayer tabs with length options and context-safe variants. | Must | MD-4 |
| FR-M12-03 | Run practice sessions with eyes-open option, 'In practice' notification pause and stop anytime. | Must | MD-5 |
| FR-M12-04 | Let users add their own rituals, prayers, recitations (text/audio/link) and recurring schedules. | Must | MD-3, MD-5 |
| FR-M12-05 | Apply MD-1 placement rules and MD-2 contraindication guard. | Must | MD-1, MD-2, pattern 41 |
| FR-M12-06 | Never select or rank content from profile data such as religion. | Must | MD-3 |
| FR-M12-07 | Send recurring reminders that respect quiet hours and 'In worship'; no streaks. | Should | MD-5 |
| FR-M12-08 | Ship an approved neutral practice library. | Must | MD-3 |

### **M13 — Feedback, Recovery & Personalisation**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M13-01 | Collect helpfulness, effort and optional re-check after every pathway. | Must | Tab 8 |
| FR-M13-02 | Show Blue Recovery when re-check improves; band rises at most one step per re-check. | Must | Tab 10 |
| FR-M13-03 | Queue the smallest next step when a demand exists. | Must | Tab 8 |
| FR-M13-04 | Re-rank allowed options from validated outcomes without changing gates or bands. | Should | NFR-07 |

### **M14 — Safety & Support**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M14-01 | Keep Help/SOS with fixed, clinically reviewed copy reachable from every screen. | Must | MD-6 |
| FR-M14-02 | Run one safety classifier across Need, Dump, Express and Reflect text with deterministic escalation. | Must | RF-5 |
| FR-M14-03 | Let users build a support plan with per-contact consent. | Should | NFR-05 |

### **M15 — Progress, Reports & Sharing**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M15-01 | Show accessible progress with text equivalents and no clinical interpretation. | Should | NFR-01 |
| FR-M15-02 | Let users share selected records with a named professional, with expiry and revoke. | Should | NFR-05 |
| FR-M15-03 | Free: 30-day progress and one simple summary share; Advanced: full history, insights and detailed reports. | Should | Tab 6d |

### **M16 — Settings, Privacy, Consent, Notifications & Plans**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M16-01 | Provide per-purpose consent, accessibility settings and safeguarding notice. | Must | NFR-05 |
| FR-M16-02 | Provide reminders, quiet hours and 'In worship' do-not-disturb. | Must | MD-5 |
| FR-M16-03 | Provide export, delete and safe log out. | Must | NFR-05 |
| FR-M16-04 | Provide Plans & Advanced Tools (S41): plain Free vs Advanced comparison, price from config, cancel in two taps, no dark patterns, never shown in Amber/Red or mid-session. | Must | ENT-3, ENT-8 |

### **M17 — Admin Console & Rules Configuration**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M17-01 | Enforce role-based admin access with audit. | Must | NFR-04 |
| FR-M17-02 | Version rules and content with draft → review → approve; safety rules need Safety Reviewer approval. | Must | NFR-08 |
| FR-M17-03 | Provide aggregate analytics and safety/AI monitoring. | Must | NFR-06, 14 |
| FR-M17-04 | Configure plans, prices and tool tiers with approval; block any change that removes a pathway's free tools. | Must | ENT-1, ENT-9 |

### **M18 — Institution (CAAM)**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M18-01 | Provide aggregate institution dashboards with minimum cohort size; exclude Reflect and practice data. | Should | NFR-05 |
| FR-M18-02 | Provide consent-scoped user summaries with logged access and user-accepted outreach. | Should | NFR-10 |

### **M19 — Platform, Integrations, Security & Data**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Requirement** | **Priority** | **Rules** |
| FR-M19-01 | Provide environments, CI/CD, auth, data model and encrypted storage. | Must | NFR-04, 11 |
| FR-M19-02 | Provide an analytics pipeline separating operational and research data. | Should | NFR-14 |
| FR-M19-03 | Provide a provider-agnostic AI layer with fallback. | Must | NFR-03, 13 |
| FR-M19-04 | Provide scoped third-party integrations. | Could | NFR-04 |
| FR-M19-05 | Provide payments and entitlement (app stores and web provider; trial, active, grace, lapsed, cancelled; institution licences); no card data stored. | Must | ENT-6–ENT-8 |

# **7. Non-functional requirements**

|  |  |  |
| :-: | :-: | :-: |
| **ID** | **Area** | **Requirement** |
| NFR-01 | Accessibility | WCAG 2.2 AA as the baseline; keyboard, switch and screen-reader support; text scaling; contrast; reduced motion; sound and haptic controls; plain language. |
| NFR-02 | Performance | Check-in to recommendation must feel instant; engine decision is deterministic and local-first where possible. Exact targets set by engineering after sizing. |
| NFR-03 | Reliability | Graceful degradation when AI or integrations fail; core flows and Help/SOS work without AI. |
| NFR-04 | Security | Least privilege, encryption in transit and at rest, secret management, secure sessions, environment separation. |
| NFR-05 | Privacy | Data minimisation, purpose limitation, per-purpose consent, revocable sharing, role-scoped access; UK GDPR. |
| NFR-06 | Safety | Deterministic escalation; clinical review before release; no unsafe reassurance; Help/SOS never hidden. |
| NFR-07 | Explainability | Every recommendation has a traceable rationale, rules version and model version. |
| NFR-08 | Maintainability | Rules and content versioned separately from the app release. |
| NFR-09 | Scalability | Modular cloud services from B2C to multi-tenant institutions. |
| NFR-10 | Auditability | Sensitive access and configuration changes are logged. |
| NFR-11 | Data integrity | Referential integrity and timestamps for state, recommendation, outcome and consent. |
| NFR-12 | Testability | Automated tests for state mapping, rules, gates, safety, permissions and core journeys. |
| NFR-13 | Portability | No hard dependency on one AI provider. |
| NFR-14 | R&D instrumentation | Operational analytics separated from consented research datasets; no free text in events. |
| NFR-15 | Faith neutrality (NEW) | No content selected from belief data; neutral library reviewed with faith and neurodivergent user groups; spoken prayer only in private contexts. |
| NFR-17 | Ethical monetisation (NEW v3.1) | Support is never conditional on payment; no upselling under strain; honest pricing and easy cancellation; UK consumer-protection rules for subscriptions followed; lapsed users keep their data. |
| NFR-16 | Wellbeing by design (NEW) | No streaks, scores or guilt-based reminders; Reflect is time-limited; practices have stop anytime and eyes-open versions. |

# **8. Engine rules and decision logic (summary)**

The Rules Engine workbook v3.3 is the authority. This section summarises it so designers and developers share the same picture.

## **8.1 State model (corrected)**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Cell** | **Energy** | **Mood** | **Name** | **Icon** | **Baseline band** |
| E1M1 | Very Low | Very Bad | Hibernate | 🌙 | Very Constrained (Red) |
| E1M2 | Very Low | Bad | Gentle Drift | 🌱 | Very Constrained (Red) |
| E1M3 | Very Low | Neutral | Tender Space | 🕯️ | Constrained (Amber) |
| E1M4 | Very Low | Good | Quiet Glow | ☁️ | Constrained (Amber) |
| E2M1 | Low | Very Bad | Ground First | 🌱 | Constrained (Amber) |
| E2M2 | Low | Bad | Slow Warm | ☀️ | Conditional (Yellow) |
| E2M3 | Low | Neutral | Building Up | ✨ | Conditional (Yellow) |
| E2M4 | Low | Good | Ready to Try | ⚙️ | Available (Green) |
| E3M1 | Moderate | Very Bad | Activate | 🔥 | Conditional (Yellow) |
| E3M2 | Moderate | Bad | Flow Entering | 🎯 | Conditional (Yellow) |
| E3M3 | Moderate | Neutral | Full Flow | 🌊 | Available (Green) |
| E3M4 | Moderate | Good | Creative Peak | 🎨 | Available (Green) |
| E4M1 | High | Very Bad | Regain Base | 💧 | Conditional; Constrained if any modifier applies |
| E4M2 | High | Bad | Storm Mode | ⚡ | Conditional (Yellow) |
| E4M3 | High | Neutral | Release First | 🌊 | Conditional (Yellow) |
| E4M4 | High | Good | Peak Flow | 🚀 | Available (Green) |

## **8.2 Bands and lights**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **Band** | **Light** | **Engine behaviour** | **User sees** |
| Available | Green (#5E8C61) | No support step required; go straight to the demand if there is one. | State name, icon and meaning; one CTA to start. |
| Conditional | Yellow (#D8B64C) | Light or optional support first; never blocking — “Skip to task” always visible. | A gentle offer plus “Skip to task”. |
| Constrained | Amber (#D98A3D) | Support is the forced primary; demand capped to Routine until a re-check improves the state. | “Let’s reduce the load first”, with “I’ll try the task anyway” never hidden. |
| Very Constrained | Muted Red (#B5574B) | Support forced immediately; demand deferred; Support pathway visible throughout. | “Let’s take care of you first” plus “Get support now”. |
| Recovery (overlay) | Blue (#5B7FA6) | Shown after support when the re-check improves. Demand stays gentle; band rises at most one step per re-check. | “You’re steadier” with a gentle next step; Reflect or Meditate may be offered. |

Modifiers: EX-1 (strong negative experience, shutdown, High pain or overload → down one step), CX-1 (2+ sensitivity flags in public/formal/unfamiliar setting with negative experience → down one step), CAP-1 (max two steps), UP-0 (never up within a check-in), DEM-0 (demand never changes the band).

## **8.3 NUCRIPCE and timeline**

|  |  |  |
| :-: | :-: | :-: |
| **Letter** | **Driver** | **Definition** |
| N | Novelty | The activity is new, unfamiliar, different, or offers a new experience. |
| U | Urgency | Meaningful time pressure or a consequence for delay. Derived from the Timeline code, never labelled by the user. |
| C | Challenge | Requires problem-solving, sustained effort, complexity or stretch. |
| R | Routine | Familiar, predictable, structured or low in decision cost. |
| I | Interest | Naturally captures attention, curiosity or engagement. |
| P | Passion | Strongly connected to personal meaning, values or enthusiasm. |
| C | Collaboration | The activity itself involves other people: social participation, interaction or shared work. |
| E | Exploration | Inquiry, learning, information-seeking, experimentation, research or discovery. |

  

|  |  |  |
| :-: | :-: | :-: |
| **Code** | **Label** | **Effect** |
| T0 | Now | Urgency maximum. Execute capped to 1-3 micro-steps. A needed Regulate step is shortened to 1-2 min, never skipped. |
| T1 | Later today | Urgency high. 3-5 steps. Body double defaults to AI. |
| T2 | This week | Urgency moderate. Fuller breakdown. Can invite a person as body double. |
| T3 | This month | Urgency low. Challenge/Exploration can lead. |
| T4 | Months | As T3. Routine/Interest-led planning. |
| T5 | Long-term | Urgency effectively inactive. |
| T6 | No deadline | Urgency not applicable. |
| TX | Overdue | Repair first: short factual message, then the smallest remaining step. No blame. |
| TR | Recurring | Urgency from the next occurrence; adds Routine; reminders tuned to capacity; never streaks. |

## **8.4 Decision order**

1.  Safety override check on any free text → Help/SOS if triggered.
2.  State lookup → baseline band.
3.  Apply modifiers (EX-1, CX-1, CAP-1, UP-0, DEM-0) → final band and light.
4.  Match patterns 1–41 in priority order using experience family, context, need and demand.
5.  Apply gates RF-1–RF-5 and MD-1–MD-6; replace blocked pathways with their fallback.
6.  If demand exists and band allows: tag NUCRIPCE, apply timeline caps, choose the smallest step.
7.  Entitlement filter (step 10b): keep the primary within the user's plan; add at most one labelled Advanced alternative only in Green/Yellow/Blue.
8.  Personalisation re-ranks allowed options only.
9.  Build the card: one primary, up to two alternatives, rationale; store the decision record.

# **9. User types, roles and access**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **Code** | **Role** | **Primary need** | **Access boundary** |
| CUS | Customer / End User | Neurodivergent students, professionals and others; full personal experience | Own data only; controls all sharing |
| INS | Institution Supporter | Wellbeing, education, workplace or public-sector supporter | Aggregate dashboard; consent-scoped summaries; never Reflect, practices or free text |
| ADM | NUCCESS Admin | Internal product, operations, content and rules administration | Role-scoped admin console; aggregate analytics; audited |
| TPI | Third-Party Integration Company | Calendar, identity, payment (app stores, web payment provider), communications partners | Explicit API scopes and minimum data only; never card data in Nuccess |
| PRO | Professional / Support Provider | Receives user-shared reports | Only records the user shared, until expiry or revoke |

# **10. User stories and child issues by module**

Every story follows: **As a** \[role\], **I want** \[capability\], **so that** \[outcome\]. Acceptance criteria are the test list. Child issues are the tickets each discipline picks up; 'Done when' is the exit condition for that ticket. The general Definition of Done (section 11.3) also applies. Sizes (S/M/L) are indicative; engineering confirms estimates in sprint planning.

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **Module** | **Stories** | **Child issues** | **Sprint(s)** |
| M01 Onboarding, Accounts & Home | 5 | 21 | S1 |
| M02 Check-in: Capacity Matrix | 3 | 12 | S2 |
| M03 Experience & Context | 3 | 13 | S2 |
| M04 Need, Demand & Recommendation Engine | 8 | 32 | S3, S4 |
| M05 Regulate | 3 | 14 | S5 |
| M06 Dump | 3 | 13 | S6 |
| M07 Express | 3 | 13 | S6 |
| M08 Execute (Tasks, Focus, Body Double) | 4 | 17 | S7 |
| M09 Adapt | 3 | 12 | S8 |
| M10 Connect | 3 | 13 | S8 |
| M11 Reflect (NEW) | 6 | 24 | S9 |
| M12 Meditate · Rituals · Prayer (NEW) | 8 | 29 | S9 |
| M13 Feedback, Recovery & Personalisation | 3 | 10 | S10 |
| M14 Safety & Support | 3 | 11 | S5 |
| M15 Progress, Reports & Sharing | 4 | 14 | S10 |
| M16 Settings, Privacy, Consent, Notifications & Plans | 4 | 15 | S1, S11 |
| M17 Admin Console & Rules Configuration | 6 | 20 | S11 |
| M18 Institution (CAAM) | 3 | 10 | S12 |
| M19 Platform, Integrations, Security & Data | 7 | 21 | S0, S12, S11 |
| Total | 82 | 314 | S0–S12 |

## **M01 — Onboarding, Accounts & Home**

### **US-M01-01 · Calm welcome and journey map**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S01, S02 | **Rules:** — | **Priority:** Must | **Sprint:** S1 | **Size:** S |

  

|  |
| :-: |
| **As a** Customer, **I want** a short, calm introduction that I can skip, **so that** I understand what Nuccess does without being overloaded on day one. |

**Acceptance criteria**

  - Given I open the app for the first time, when S01 loads, then I see one sentence of purpose, a privacy promise, an accessibility shortcut and Skip.
  - Given I choose See how it works, when S02 loads, then the five steps (Check in → Support → Match → Act → Feedback) are shown one at a time with optional detail.
  - Skip is visible on every step and takes me to S04 without penalty.
  - Reduced-motion setting from the device is respected from the first frame.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M01-01.1 | [Design] | S01 and S02 layouts, including reduced-motion and large-text variants | Figma frames approved by PO; tokens from design system used |
| US-M01-01.2 | [Content] | Plain-language copy for welcome, privacy promise and the five journey steps | Copy signed off by PO; no clinical or diagnostic terms |
| US-M01-01.3 | [FE] | Build S01 and S02 with Skip routing to S04 | Matches Figma; Skip works from every step; screen-reader labels present |
| US-M01-01.4 | [QA] | Accessibility pass (screen reader, 200% text, reduced motion) | No blocking a11y defects open |

### **US-M01-02 · Quick Setup for comfort**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S03 | **Rules:** NFR-01 | **Priority:** Must | **Sprint:** S1 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to set text size, contrast, motion, sound, haptics and notification style before anything else, **so that** the app is comfortable for my senses from the first session. |

**Acceptance criteria**

  - Calm defaults are pre-selected; every setting can be skipped.
  - Preview updates live as I change a setting.
  - Choices are stored on the device before I have an account and synced to my profile when I sign up.
  - The same settings are editable later in S36.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M01-02.1 | [Design] | Quick Setup screen with live preview and calm defaults | Approved frames for light, dark and high-contrast themes |
| US-M01-02.2 | [FE] | Preference controls bound to the theme/typography system | Changing a control re-renders the preview immediately |
| US-M01-02.3 | [BE] | Preferences endpoint and local-to-account sync on sign-up | Preferences persist across devices after login |
| US-M01-02.4 | [QA] | Regression check that preferences apply on every screen | Spot check of S05, S06, S13, S27 passes in all themes |

### **US-M01-03 · Enter my space with as little as possible**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S04 | **Rules:** Tab 11; age/safeguarding rule | **Priority:** Must | **Sprint:** S1 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to sign up, register a fuller profile, or browse without an account, **so that** I can start without giving more than I want to. |

**Acceptance criteria**

  - Options shown: Sign in (returning users, see US-M01-05), Sign up (email or identity provider), Register full profile (all extra fields optional), Browse without an account.
  - Only login details are mandatory; diagnosis, religion and other sensitive fields are never required.
  - The age and safeguarding rule configured by Admin is applied before an account is created.
  - Browse mode stores nothing on the server; I am told what I lose by not signing in.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M01-03.1 | [Design] | S04 with three clear entry routes and the 'what browse mode keeps' note | Approved by PO and Designer |
| US-M01-03.2 | [FE] | Sign-up, register and browse flows | Each route reaches S05; validation messages are plain-language |
| US-M01-03.3 | [BE] | Account creation, optional profile fields, age rule check | Sensitive fields stored only when entered; age rule enforced server-side |
| US-M01-03.4 | [QA] | Test each route, including under-age path and browse mode | All three routes and the blocked path behave as specified |

### **US-M01-04 · Home / Now as a calm launch point**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S05 | **Rules:** Tab 8 | **Priority:** Must | **Sprint:** S1 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** one calm screen showing my current state and one next action, **so that** I always know where to start, and help is always one tap away. |

**Acceptance criteria**

  - Shows my last state name and icon (never the cell ID), one suggested next action, Check in, 'I need help with something', quick Dump and one-tap Regulate.
  - Help/SOS is visible on Home at all times.
  - If a saved practice is due (TR) Home shows it as a gentle card, never as a warning.
  - No more than one primary button is shown.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M01-04.1 | [Design] | Home layouts for first use, returning user, and practice-due state | Frames approved; one primary CTA rule documented |
| US-M01-04.2 | [FE] | Build Home with entry points to S06, S16, S14, S31 and the next-action card | All entry points route correctly |
| US-M01-04.3 | [BE] | 'Next action' endpoint (last recommendation, queued step or due practice) | Returns one item with a reason string |
| US-M01-04.4 | [QA] | Check Home for each state band and with/without due practice | Expected card appears in each case |

### **US-M01-05 · Sign back in quickly and safely**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S04, S05 | **Rules:** Activity Process 2; NFR-04 | **Priority:** Must | **Sprint:** S1 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to sign in with email, passkey, social login or my institution and find everything as I left it, **so that** returning to Nuccess takes seconds and never feels like starting again. |

**Acceptance criteria**

  - S04 shows Sign in first for returning users; a remembered device goes straight to Home.
  - Methods: email + password, passkey/biometrics, social login, institution single sign-on.
  - Failed sign-in messages are calm and never reveal whether an email has an account; lockout after the configured number of attempts; password reset by time-limited link signs out other sessions.
  - After sign-in, preferences are applied before the first screen renders; support plan, saved practices, reminders, consent and plan entitlement are restored; offline records sync.
  - Help/SOS is reachable on S04 without signing in.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M01-05.1 | [Design] | Sign-in, forgotten-password and lockout states on S04 | All states approved; copy is calm and non-blaming |
| US-M01-05.2 | [FE] | Sign-in flows for each method, remember-device option | Each method reaches Home with preferences already applied |
| US-M01-05.3 | [BE] | Session restore: preferences, support plan, practices, consent, entitlement, offline sync | Restore completes before Home renders; sync conflicts keep both versions |
| US-M01-05.4 | [BE] | Security: lockout, reset links, new-device notification, sign-in audit log | Meets security review checklist; no passwords in logs |
| US-M01-05.5 | [QA] | Sign-in matrix (method × success/failure/lockout/reset) and offline sync | All cases behave as specified |

## **M02 — Check-in: Capacity Matrix**

### **US-M02-01 · Check in with Energy × Mood**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S06 | **Rules:** Tab 1, Tab 10 | **Priority:** Must | **Sprint:** S2 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to tell Nuccess my energy and mood in one or two taps, **so that** the app understands my capacity right now. |

**Acceptance criteria**

  - Energy (Very Low, Low, Moderate, High) and Mood (Very Bad, Bad, Neutral, Good) can be set as two taps or one grid tap.
  - After selection I see the state name, icon and one-line meaning from the approved copy (e.g. 'Ground First 🌱').
  - Cell IDs (E2M1), band names, traffic-light names and the word 'grid' never appear to the user.
  - A 'Not sure' link is always visible and goes to S07.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M02-01.1 | [Design] | Capacity Matrix interaction: two-tap and grid modes, state result card | Prototype tested with at least 5 neurodivergent users |
| US-M02-01.2 | [Content] | Load the 16 approved state names, icons and meanings | Strings match Tab 1 / Architecture Spec section 5 exactly |
| US-M02-01.3 | [FE] | Build S06 with both input modes and the result card | Selecting any of 16 cells shows the correct name/icon/meaning |
| US-M02-01.4 | [BE] | Save CheckIn {energy, mood, cell_id, timestamp, source} | Record created; cell_id derived server-side |
| US-M02-01.5 | [QA] | Test all 16 cells and screen-reader announcement of the result | 16/16 correct |

### **US-M02-02 · 'Not sure' body check**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S07 | **Rules:** Tab 1 | **Priority:** Must | **Sprint:** S2 | **Size:** S |

  

|  |
| :-: |
| **As a** Customer, **I want** to answer three picture-based questions when I cannot name how I feel, **so that** I can still check in when interoception is hard. |

**Acceptance criteria**

  - Three picture taps (body, energy, comfort) produce a suggested state: 'Does this sound like you?'.
  - I can confirm the suggestion or pick a different state myself.
  - The suggestion is stored as source = 'body\_check' so analytics can tell it apart.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M02-02.1 | [Design] | Three picture-based question cards and the confirm step | Images reviewed for clarity and inclusivity |
| US-M02-02.2 | [FE] | Build S07 and hand the suggested state back to S06 result | Confirm and 'Pick anyway' both work |
| US-M02-02.3 | [BE] | Mapping table from three answers to a suggested cell (configurable) | Mapping editable in Admin without a release |
| US-M02-02.4 | [QA] | Test every answer combination maps to a valid cell | No combination returns empty |

### **US-M02-03 · State-mapping service**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Developer (on behalf of Customer) | **Screens:** S06, engine | **Rules:** Tab 1, Tab 10 | **Priority:** Must | **Sprint:** S2 | **Size:** S |

  

|  |
| :-: |
| **As a** Developer (on behalf of Customer), **I want** a single versioned service that turns Energy and Mood into a cell and a baseline band, **so that** every screen and the engine use the same truth. |

**Acceptance criteria**

  - Lookup returns cell\_id, name, icon, meaning and baseline band for all 16 cells.
  - E4M1 returns Conditional, becoming Constrained if any modifier applies (handled by M04).
  - Mapping is read from configuration with a version number stored on every check-in.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M02-03.1 | [BE] | Implement state lookup from versioned config | Unit tests cover all 16 cells |
| US-M02-03.2 | [Data] | Seed config from Rules Engine v3.2 Tab 1 | Seed script reproducible; version recorded |
| US-M02-03.3 | [QA] | Contract test between S06 and the service | Contract test in CI |

## **M03 — Experience & Context**

### **US-M03-01 · Emotions and intensity**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S08 | **Rules:** Tab 2, Tab 10 (EX-1) | **Priority:** Must | **Sprint:** S2 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to pick up to three emotions and say how strong each one is, **so that** Nuccess knows what I am going through, separate from my mood. |

**Acceptance criteria**

  - Emotion chips with emoji plus a custom option; up to three can be chosen.
  - Each chosen emotion has an intensity 0–10 shown with plain labels (Mild, Moderate, High, Very High).
  - New families from v3.2 are available: wanting to make sense, relief, recurring struggle, anticipatory unease, need for stillness, spiritual/faith need, gratitude, rumination.
  - Skip is always available and does not block the flow.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M03-01.1 | [Design] | Emotion chip set, intensity slider with labels, custom entry | Frames approved; slider usable with switch access |
| US-M03-01.2 | [Content] | Emotion list and family mapping from Tab 2 (rows 1–38) | List matches workbook v3.2 |
| US-M03-01.3 | [FE] | Build S08 with max-3 rule and per-emotion intensity | Fourth selection is prevented with a friendly message |
| US-M03-01.4 | [BE] | Store Experience {emotion, family, intensity} linked to the check-in | Family resolved server-side from config |
| US-M03-01.5 | [QA] | Test family resolution for all v3.2 families | Each family reaches the engine correctly |

### **US-M03-02 · Sensations and body map**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S09 | **Rules:** Tab 3, Tab 10 | **Priority:** Should | **Sprint:** S2 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to optionally mark sensations, pain and body needs, **so that** the tools offered fit my body as well as my feelings. |

**Acceptance criteria**

  - Six categories: Sensory, Cognitive, Body (pain with its own intensity), Communication, Movement, Interoception (hunger, thirst, toilet, sleepiness, too hot/cold).
  - A tappable body map is optional; list input gives the same result.
  - Shutdown, feeling detached/unreal and sensory overload are captured as flags the engine can read (used by MD-2).

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M03-02.1 | [Design] | Body map and category lists with accessible list alternative | Body map has a non-visual equivalent |
| US-M03-02.2 | [FE] | Build S09 including pain intensity | Data reaches the check-in payload |
| US-M03-02.3 | [BE] | Store Sensation records and derived flags (shutdown, detached, overload_level) | Flags available to the engine |
| US-M03-02.4 | [QA] | Test flags drive MD-2 and EX-1 cases | Fixture scenarios pass |

### **US-M03-03 · Context and sensitivity**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S10 | **Rules:** Tab 3, Tab 3b, Tab 10 (CX-1) | **Priority:** Must | **Sprint:** S2 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to say where I am, who is around and what I am sensitive to, **so that** suggestions are realistic for my setting. |

**Acceptance criteria**

  - Environment, social setting, time/transition and available support can be chosen or confirmed from suggestions.
  - Sensitivity flags: Sound, Noise, Lights, Crowd, Smell, Temperature, Touch, Visual clutter.
  - New v3.2 contexts are available: prayer or quiet room, place of worship; public/formal/observed settings set the public filter used by MD-4 and Regulate.
  - Suggestions are editable and never auto-applied without confirmation.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M03-03.1 | [Design] | Context picker with editable suggestions | Approved frames |
| US-M03-03.2 | [FE] | Build S10 | Selections saved and shown back on S13 rationale |
| US-M03-03.3 | [BE] | Store Context; compute public_filter and sensitivity_count | Values available to the engine |
| US-M03-03.4 | [QA] | CX-1 cases: 2+ flags in public with negative experience lowers band one step | Fixture scenarios pass |

## **M04 — Need, Demand & Recommendation Engine**

### **US-M04-01 · Tell Nuccess what I need**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S11 | **Rules:** Tab 6, Tab 6b | **Priority:** Must | **Sprint:** S3 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to choose a need in plain words, type or speak it, or just say 'I just want support', **so that** I get the right kind of help without needing the right words. |

**Acceptance criteria**

  - The needs list includes the v3.2 additions: 'Make sense of today', 'Help me speak up for myself', 'Find stillness', 'Pray or do my practice', 'I'm grateful and want to note it'.
  - 'I just want support' skips the demand step and goes straight to the engine.
  - Typed or spoken needs pass the Safety screen before any routing (RF-5 / safety override).

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M04-01.1 | [Design] | Need screen with list, free text and voice | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M04-01.2 | [Content] | Need labels mapped to pathways from Tab 6b rows 1–25 | Every label maps to exactly one need code |
| US-M04-01.3 | [FE] | Build S11 with skip-demand route | Routes to S12 or S13 correctly |
| US-M04-01.4 | [BE] | Need classifier for free text, with safety pre-check | Unknown text falls back to 'I just want support' |
| US-M04-01.5 | [QA] | Test each need label lands on the expected pathway set | Matches Tab 6b |

### **US-M04-02 · Add an activity and when it is due**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S12 | **Rules:** Tab 4, Tab 6 | **Priority:** Must | **Sprint:** S3 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to optionally add what I need to do and when, **so that** the suggestion fits my deadline without me rating urgency. |

**Acceptance criteria**

  - Timeline is chosen in plain words: Now, Later today, This week, This month, Months, Long-term, No deadline, Overdue, Recurring (T0–T6, TX, TR).
  - Urgency is derived from the timeline; the user is never asked to rate urgency.
  - If several activities are entered I am asked to pick ONE to start with.
  - 'I've been putting this off' toggle is available and feeds Execute's repair flow.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M04-02.1 | [Design] | Demand & Timeline screen | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M04-02.2 | [FE] | Build S12 with pick-one rule | Only one demand passes to the engine per run |
| US-M04-02.3 | [BE] | Store Demand {text, timeline_code, recurring_rule?, avoidance_flag} | Timeline code saved; urgency derived in engine |
| US-M04-02.4 | [QA] | Timeline mapping tests T0–TR | All nine codes derived correctly |

### **US-M04-03 · Band and traffic light with safety modifiers**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** Engine | **Rules:** Tab 10 (EX-1, CX-1, CAP-1, UP-0, DEM-0) | **Priority:** Must | **Sprint:** S3 | **Size:** L |

  

|  |
| :-: |
| **As a** Customer, **I want** the app to read my capacity safely, not optimistically, **so that** I am never pushed into a task when I need support first. |

**Acceptance criteria**

  - Baseline band comes from the cell (M02-03).
  - EX-1: High/Very High negative experience, shutdown, High pain or sensory overload lowers the band one step.
  - CX-1: 2+ sensitivity flags in a public, formal or unfamiliar setting with a negative experience lowers one step; together at most two steps (CAP-1).
  - UP-0: positive signals never raise the band within a check-in. DEM-0: demand and timeline never change the band.
  - Output: band, traffic light and the list of modifiers applied (for the rationale).

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M04-03.1 | [BE] | Band calculator with modifiers as pure functions | Unit tests for each modifier and the two-step cap |
| US-M04-03.2 | [Data] | Load modifier thresholds from versioned config | Thresholds editable via M17 |
| US-M04-03.3 | [QA] | Run Tab 10 and Tab 0 fixture rows as automated tests | 100% of fixtures pass |

### **US-M04-04 · Pathway selection with Reflect and Meditate gates**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** Engine | **Rules:** Tab 7 (patterns 1–41), Tab 6c (RF-1–5, MD-1–6) | **Priority:** Must | **Sprint:** S4 | **Size:** L |

  

|  |
| :-: |
| **As a** Customer, **I want** the engine to pick the pathway that fits, including Reflect and Meditate when they are safe, **so that** I get the right support and am protected from what could make things worse. |

**Acceptance criteria**

  - The engine returns one primary pathway and up to two alternatives from the eight pathways.
  - Amber and Red force a support pathway first (Regulate, Dump or Connect by trigger); 'I'll try the task anyway' is never hidden in Amber.
  - Reflect obeys RF-1 (Green, Blue; Yellow only Mild/Moderate; Amber = remind me later; Red = not offered) and RF-2 rumination guard (pattern 40).
  - Meditate obeys MD-1 (primary in Green, Yellow, Blue, calm Amber) and MD-2 contraindication guard (pattern 41).
  - Every result stores the pattern number(s) that fired.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M04-04.1 | [BE] | Pattern matcher for patterns 1–41 in priority order | Patterns evaluated deterministically; same input = same output |
| US-M04-04.2 | [BE] | Gate layer for RF-1/RF-2 and MD-1/MD-2 applied after pattern match | Blocked pathways replaced by the fallback in Tab 7 |
| US-M04-04.3 | [Data] | Rumination history query (same topic 3+ times in 7 days without improvement; worse after last Reflect) | Query returns within the engine time budget |
| US-M04-04.4 | [Safety] | Clinical Safety Director review of RF and MD gates | Signed-off note attached to the epic |
| US-M04-04.5 | [QA] | Automate Tab 0b scenarios RF.1–RF.8, MD.1–MD.11, GD.1–GD.3 | All 22 scenarios pass |

### **US-M04-05 · NUCRIPCE demand tagging**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** Engine | **Rules:** Tab 6 (rows 1–21) | **Priority:** Must | **Sprint:** S4 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** my activity to be understood by what drives it, **so that** the step offered matches what actually helps me start. |

**Acceptance criteria**

  - Activities are tagged with any of Novelty, Urgency, Challenge, Routine, Interest, Passion, Collaboration, Exploration.
  - Urgency comes only from the timeline code.
  - Amber caps demand to Routine until a re-check improves the state; Red defers demand.
  - Collaboration (activity involves people) is kept separate from Connect (need for contact).

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M04-05.1 | [BE] | Tagger using keyword rules plus user confirmation | Tags stored with confidence and source |
| US-M04-05.2 | [Content] | Driver descriptions for tooltips (from Architecture Spec section 6) | Copy approved |
| US-M04-05.3 | [QA] | Test Amber Routine cap and Red deferral | Test cases written, automated where possible, and passing in CI |

### **US-M04-06 · One clear recommendation card**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S13 | **Rules:** Tab 8, Tab 9 | **Priority:** Must | **Sprint:** S4 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** one suggestion with a short 'because' and a couple of alternatives, **so that** I can act without having to decide between many options. |

**Acceptance criteria**

  - Card shows state name and icon, traffic light, ONE primary CTA, up to two alternatives, and 'Because …, Nuccess suggests …'.
  - Not now and Try another are always available. In Red, 'Get support now' is shown on the card.
  - Reflect in Amber shows 'Save for later' instead of Start.
  - Card copy never uses the words 'intervention', 'pathway', 'band' or cell IDs.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M04-06.1 | [Design] | Card variants for each light and for support-only vs support + task | Variants approved |
| US-M04-06.2 | [Content] | Card copy templates from Tab 8/Tab 9 incl. Reflect and Meditate | Templates loaded via config |
| US-M04-06.3 | [FE] | Build S13 and route to the chosen module | All eight pathways reachable |
| US-M04-06.4 | [QA] | Check one-CTA rule and Red support button | Test cases written, automated where possible, and passing in CI |

### **US-M04-07 · Explainable decision log**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Admin / Developer | **Screens:** Engine, S37 | **Rules:** NFR-07, NFR-10 | **Priority:** Must | **Sprint:** S4 | **Size:** S |

  

|  |
| :-: |
| **As an** Admin / Developer, **I want** every recommendation to be stored with its inputs, rules and versions, **so that** we can explain, audit and improve decisions. |

**Acceptance criteria**

  - Each Recommendation stores input snapshot, band, modifiers, patterns fired, gates applied, rules version and model version.
  - The user-facing rationale is generated from the same record.
  - Personal free text is not stored in the log; only codes.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M04-07.1 | [BE] | Recommendation record and write path | Record written for every engine run |
| US-M04-07.2 | [Data] | Schema and retention rule | Retention configured |
| US-M04-07.3 | [QA] | Spot-audit 20 runs against fixtures | Inputs/outputs reproducible |

### **US-M04-08 · Entitlement-aware recommendations**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S13, engine | **Rules:** Tab 6d (ENT-1–ENT-9); Tab 8 step 10b | **Priority:** Must | **Sprint:** S4 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** the card always to offer something I can actually open, and never to sell to me when I'm struggling, **so that** support never depends on my wallet. |

**Acceptance criteria**

  - After gates, the entitlement filter keeps the primary within the user's plan; if the best fit is Advanced and the user is Free, the best free tool in the same pathway becomes primary.
  - In Green, Yellow (Mild/Moderate) or Blue, at most ONE Advanced alternative may be added, labelled 'Advanced'.
  - In Amber, Red, at High/Very High negative intensity, after a safety event or during a session: safety-floor tools only, no Advanced tiles, no prices, no upgrade prompts.
  - Dismissing an Advanced tile ('Not now') is remembered for the session.
  - Gate decisions (RF/MD) are identical for Free and Plus users.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M04-08.1 | [BE] | Entitlement filter step after the gate layer | Unit tests: Free and Plus users get identical gate results |
| US-M04-08.2 | [Data] | ToolCatalogue with tier and safety_floor flags, loaded from Tab 6d | Every pathway has ≥1 free tool per light and context (validation script) |
| US-M04-08.3 | [FE] | 'Advanced' label and lock state on card alternatives | Label is text, not colour alone; hidden in Amber/Red |
| US-M04-08.4 | [Safety] | Clinical Safety Director review of the safety-floor list and ENT-3 triggers | Signed-off note attached |
| US-M04-08.5 | [QA] | Tab 6d scenarios ENT.1–ENT.6 as automated fixtures | All pass |

## **M05 — Regulate**

### **US-M05-01 · Choose a regulation tool that fits where I am**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S14 | **Rules:** Tab 3b, Tab 7 | **Priority:** Must | **Sprint:** S5 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** a short list of regulation tools filtered for my setting, **so that** I can calm or reset without drawing attention. |

**Acceptance criteria**

  - Tools: Breathe, Ground, Move, Sounds, Create, Step out, Attention reset, Recovery/rest, Sleep wind-down.
  - In public, formal or observed settings discreet variants are shown first.
  - Short breath and grounding micro-tools stay in Regulate (they are NOT moved to Meditate).

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M05-01.1 | [Design] | Regulate home with discreet badges | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M05-01.2 | [Content] | Tool descriptions and lengths, clinically reviewed | Review recorded |
| US-M05-01.3 | [FE] | Build S14 with context filter | Filter matches Tab 3b |
| US-M05-01.4 | [QA] | Public-setting filter test | Test cases written, automated where possible, and passing in CI |

### **US-M05-02 · Run one regulation session**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S15 | **Rules:** Tab 4 (T0) | **Priority:** Must | **Sprint:** S5 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** a simple guided session I can stop at any time, **so that** I can steady myself quickly. |

**Acceptance criteria**

  - Visual pacer, audio or steps; tap-only non-verbal mode; length options.
  - With a T0 deadline the session is shortened to 1–2 minutes but never skipped.
  - Stop is always visible; stopping goes to Feedback (S30).

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M05-02.1 | [Design] | Session player states (start, running, paused, done) | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M05-02.2 | [FE] | Session player with pacer, audio and haptics | Works offline for core tools |
| US-M05-02.3 | [BE] | Session record {tool, length, completed, stopped_at} | Record saved, linked to the check-in and covered by unit tests |
| US-M05-02.4 | [QA] | T0 shortening and stop-anytime tests | Test cases written, automated where possible, and passing in CI |

### **US-M05-03 · Free and Advanced tools in Regulate**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S14, S15 | **Rules:** Tab 6d; ENT-1–ENT-3 | **Priority:** Must | **Sprint:** S5 | **Size:** L |

  

|  |
| :-: |
| **As a** Customer, **I want** free Regulate tools I can always use, and Advanced Regulate tools I can unlock if I want more, **so that** I get real help for free and can choose extra depth that is worth paying for. |

**Acceptance criteria**

  - Free tools: Breathe (core paced patterns, 1–5 min); Ground (5-4-3-2-1, feet on floor, cold-water cue); Move (shake-out, stretch, short walk prompt); Sounds (core set: brown/white noise, rain, quiet timer); Step out; Recovery/rest timer; discreet public variants; tap-only non-verbal mode.
  - Advanced tools (Plus or institution licence): Advanced Sounds (full soundscape library, personal mixer, offline downloads); Advanced Movement (sensory-diet and proprioceptive routines, guided movement videos, desk and commute routines); Create (drawing, colouring, rhythm and music-making, fidget canvas); Attention reset games; Sleep wind-down programmes; personal regulation toolkit ordered by what helped.
  - Free tools are listed first; Advanced tools carry an 'Advanced' text label; locked tiles are hidden in Amber/Red and during distress.
  - A free user tapping an Advanced tile in Green/Yellow/Blue sees a short explanation and S41 with 'Not now'.
  - Breathe, Ground, Move, core Sounds, Step out and Rest are the safety floor and can never be moved to Advanced.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M05-03.1 | [Design] | Regulate tool list with Free and Advanced states (unlocked, locked, hidden) | Frames approved; label readable by screen readers |
| US-M05-03.2 | [Content] | Scripts, audio or templates for the Advanced Regulate tools | Approved by PO; safety review where the tool touches distress |
| US-M05-03.3 | [FE] | Build Advanced Regulate tools behind the entitlement check | Locked for Free users; unlocked instantly after purchase |
| US-M05-03.4 | [BE] | Entitlement check on every Advanced tool endpoint | Server refuses Advanced content without entitlement |
| US-M05-03.5 | [Content] | Advanced soundscape library and movement routines (recorded, licensed for commercial use) | Licences on file; offline download works |
| US-M05-03.6 | [QA] | Free vs Plus vs institution-licence tests for Regulate | Correct tools shown per plan and per light |

## **M06 — Dump**

### **US-M06-01 · Get it out of my head fast**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S16 | **Rules:** Tab 7 | **Priority:** Must | **Sprint:** S6 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to capture thoughts by text, voice or photo with no sorting, **so that** my head feels lighter straight away. |

**Acceptance criteria**

  - Text, voice and photo capture; autosave every few seconds.
  - No categories or titles required.
  - Free text passes the Safety screen; a safety hit opens S31 gently.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M06-01.1 | [Design] | Capture screen with three modes | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M06-01.2 | [FE] | Build S16 with autosave | No data lost on app close |
| US-M06-01.3 | [BE] | DumpEntry storage and voice transcription | Transcription failures keep the audio |
| US-M06-01.4 | [QA] | Autosave and safety hit tests | Test cases written, automated where possible, and passing in CI |

### **US-M06-02 · Optionally sort what I dumped**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S17 | **Rules:** Tab 7 | **Priority:** Should | **Sprint:** S6 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** suggested buckets I can accept or ignore, **so that** nothing becomes a task unless I decide. |

**Acceptance criteria**

  - Suggested buckets: Ideas, Notes, Worries, To-do — all editable.
  - I can send an item to Execute, Express or Reflect; Reflect is only offered when RF-1/RF-2 allow it.
  - Discard is available and confirms once.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M06-02.1 | [Design] | Review screen with bucket chips and send-to actions | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M06-02.2 | [FE] | Build S17 | Send-to routes work |
| US-M06-02.3 | [BE] | AI bucket suggestion behind the AI service layer | Falls back to no suggestion if AI is unavailable |
| US-M06-02.4 | [QA] | Reflect send-to hidden when gate blocks | Test cases written, automated where possible, and passing in CI |

### **US-M06-03 · Free and Advanced tools in Dump**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S16, S17 | **Rules:** Tab 6d; ENT-1–ENT-3 | **Priority:** Must | **Sprint:** S6 | **Size:** L |

  

|  |
| :-: |
| **As a** Customer, **I want** free Dump tools I can always use, and Advanced Dump tools I can unlock if I want more, **so that** I get real help for free and can choose extra depth that is worth paying for. |

**Acceptance criteria**

  - Free tools: Unlimited text capture; voice capture (time allowance); manual sorting into Ideas, Notes, Worries, To-do; move an item to a task by hand.
  - Advanced tools (Plus or institution licence): AI sorting suggestions; photo and document capture with text recognition; search across all dumps; longer voice notes with transcription; one-tap convert to task, draft or reflection.
  - Free tools are listed first; Advanced tools carry an 'Advanced' text label; locked tiles are hidden in Amber/Red and during distress.
  - A free user tapping an Advanced tile in Green/Yellow/Blue sees a short explanation and S41 with 'Not now'.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M06-03.1 | [Design] | Dump tool list with Free and Advanced states (unlocked, locked, hidden) | Frames approved; label readable by screen readers |
| US-M06-03.2 | [Content] | Scripts, audio or templates for the Advanced Dump tools | Approved by PO; safety review where the tool touches distress |
| US-M06-03.3 | [FE] | Build Advanced Dump tools behind the entitlement check | Locked for Free users; unlocked instantly after purchase |
| US-M06-03.4 | [BE] | Entitlement check on every Advanced tool endpoint | Server refuses Advanced content without entitlement |
| US-M06-03.5 | [QA] | Free vs Plus vs institution-licence tests for Dump | Correct tools shown per plan and per light |

## **M07 — Express**

### **US-M07-01 · Help me put it into words**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S18, S19 | **Rules:** Tab 7 | **Priority:** Must | **Sprint:** S6 | **Size:** L |

  

|  |
| :-: |
| **As a** Customer, **I want** to draft, rewrite, simplify or structure a message, **so that** I can communicate what I mean. |

**Acceptance criteria**

  - Tools: Draft, Rewrite, Simplify, Structure, Script, Alternative communication, Simplify a resource.
  - Output is fully editable; meaning is preserved; changes are explained.
  - Nothing is ever sent automatically; Copy, Save and Export only.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M07-01.1 | [Design] | Express home and workspace | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M07-01.2 | [FE] | Build S18–S19 with editable output | Edits tracked locally |
| US-M07-01.3 | [BE] | Express AI prompts with meaning-preservation checks | Prompt set versioned |
| US-M07-01.4 | [Safety] | Review prompts for tone and harm | Sign-off recorded |
| US-M07-01.5 | [QA] | No auto-send regression test | Test cases written, automated where possible, and passing in CI |

### **US-M07-02 · Cool off before sending, and continue from Reflect**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S19 | **Rules:** Pattern 35 | **Priority:** Should | **Sprint:** S6 | **Size:** S |

  

|  |
| :-: |
| **As a** Customer, **I want** a 'send later' option and my Reflect notes carried into a draft, **so that** I don't send in anger and I don't repeat myself. |

**Acceptance criteria**

  - 'Send later' saves the draft and reminds me after a chosen time.
  - When I come from Reflect (self-advocacy prep) my key points are pre-filled as bullets I can edit.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M07-02.1 | [FE] | Send-later reminder and Reflect pre-fill | Pre-fill visible and editable |
| US-M07-02.2 | [BE] | Hand-off payload from Reflect to Express | Only the takeaway and points transfer, not the whole reflection |
| US-M07-02.3 | [QA] | Hand-off test RF.5 | Test cases written, automated where possible, and passing in CI |

### **US-M07-03 · Free and Advanced tools in Express**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S18, S19 | **Rules:** Tab 6d; ENT-1–ENT-3 | **Priority:** Must | **Sprint:** S6 | **Size:** L |

  

|  |
| :-: |
| **As a** Customer, **I want** free Express tools I can always use, and Advanced Express tools I can unlock if I want more, **so that** I get real help for free and can choose extra depth that is worth paying for. |

**Acceptance criteria**

  - Free tools: Simplify and Rewrite (fair-use daily allowance); communication cards ('I need a minute', non-speaking cards); ready templates for asking for help or a pause.
  - Advanced tools (Plus or institution licence): Draft from scratch; Structure long documents and emails; Scripts for meetings, calls and presentations; tone check ('how might this land?'); Simplify a resource (upload a letter or PDF); voice-to-structured message; send-later scheduling; unlimited use.
  - Free tools are listed first; Advanced tools carry an 'Advanced' text label; locked tiles are hidden in Amber/Red and during distress.
  - A free user tapping an Advanced tile in Green/Yellow/Blue sees a short explanation and S41 with 'Not now'.
  - Communication cards and help templates are always free (ENT-2).

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M07-03.1 | [Design] | Express tool list with Free and Advanced states (unlocked, locked, hidden) | Frames approved; label readable by screen readers |
| US-M07-03.2 | [Content] | Scripts, audio or templates for the Advanced Express tools | Approved by PO; safety review where the tool touches distress |
| US-M07-03.3 | [FE] | Build Advanced Express tools behind the entitlement check | Locked for Free users; unlocked instantly after purchase |
| US-M07-03.4 | [BE] | Entitlement check on every Advanced tool endpoint | Server refuses Advanced content without entitlement |
| US-M07-03.5 | [QA] | Free vs Plus vs institution-licence tests for Express | Correct tools shown per plan and per light |

## **M08 — Execute (Tasks, Focus, Body Double)**

### **US-M08-01 · State-aware task list**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S20 | **Rules:** Tab 6, Tab 7 | **Priority:** Must | **Sprint:** S7 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** my tasks ordered for my current state with a 'why now', **so that** I start with what I can actually do. |

**Acceptance criteria**

  - Task cards show timeline and NUCRIPCE indicators.
  - Order respects band: Amber shows Routine only; Red hides demand behind support.
  - Pick-one-of-three view is available.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M08-01.1 | [Design] | Task list and pick-one-of-three | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M08-01.2 | [FE] | Build S20 with add task by type/speech | Behaves as described in the acceptance criteria on mobile and web |
| US-M08-01.3 | [BE] | Ordering service using band + NUCRIPCE + timeline | Deterministic order |
| US-M08-01.4 | [QA] | Band-based ordering tests | Test cases written, automated where possible, and passing in CI |

### **US-M08-02 · Break it down and repair overdue work**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S21 | **Rules:** Tab 4 (T0–TX) | **Priority:** Must | **Sprint:** S7 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** the smallest next step and help with things that are overdue, **so that** starting feels possible and I'm not blamed. |

**Acceptance criteria**

  - Steps are capped by timeline: T0 1–3 micro-steps, T1 3–5, T2+ fuller breakdown.
  - Overdue (TX): repair first with a short factual message (via Express), then the smallest remaining step.
  - Steps are editable and reorderable.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M08-02.1 | [Design] | Breakdown and overdue repair helper | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M08-02.2 | [FE] | Build S21 | Edits saved |
| US-M08-02.3 | [BE] | Breakdown generator with timeline caps | Caps enforced server-side |
| US-M08-02.4 | [QA] | Cap tests per timeline code | Test cases written, automated where possible, and passing in CI |

### **US-M08-03 · Focus session with a body double**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S22 | **Rules:** Tab 4 | **Priority:** Should | **Sprint:** S7 | **Size:** L |

  

|  |
| :-: |
| **As a** Customer, **I want** to work on one step with a timer and an AI or human body double, **so that** I can keep going. |

**Acceptance criteria**

  - One active micro-step at a time; optional timer.
  - AI body double by default at T0/T1; a person can be invited at T2+.
  - Pause, Adapt and Complete always available; Complete goes to Feedback.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M08-03.1 | [Design] | Focus session and body-double states | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M08-03.2 | [FE] | Build S22 | Works on mobile lock screen |
| US-M08-03.3 | [BE] | Body-double session service (AI and invite link) | Invite expires after session |
| US-M08-03.4 | [QA] | Session flow tests | Test cases written, automated where possible, and passing in CI |

### **US-M08-04 · Free and Advanced tools in Execute**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S20–S22 | **Rules:** Tab 6d; ENT-1–ENT-3 | **Priority:** Must | **Sprint:** S7 | **Size:** L |

  

|  |
| :-: |
| **As a** Customer, **I want** free Execute tools I can always use, and Advanced Execute tools I can unlock if I want more, **so that** I get real help for free and can choose extra depth that is worth paying for. |

**Acceptance criteria**

  - Free tools: Task list with 'why now'; smallest next step; basic breakdown (up to the timeline cap); pick-one-of-three; simple focus timer.
  - Advanced tools (Plus or institution licence): Full breakdown with editing and re-planning; AI body double; human body-double rooms; recurring routine builder; calendar sync; overdue repair assistant (message + re-plan).
  - Free tools are listed first; Advanced tools carry an 'Advanced' text label; locked tiles are hidden in Amber/Red and during distress.
  - A free user tapping an Advanced tile in Green/Yellow/Blue sees a short explanation and S41 with 'Not now'.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M08-04.1 | [Design] | Execute tool list with Free and Advanced states (unlocked, locked, hidden) | Frames approved; label readable by screen readers |
| US-M08-04.2 | [Content] | Scripts, audio or templates for the Advanced Execute tools | Approved by PO; safety review where the tool touches distress |
| US-M08-04.3 | [FE] | Build Advanced Execute tools behind the entitlement check | Locked for Free users; unlocked instantly after purchase |
| US-M08-04.4 | [BE] | Entitlement check on every Advanced tool endpoint | Server refuses Advanced content without entitlement |
| US-M08-04.5 | [QA] | Free vs Plus vs institution-licence tests for Execute | Correct tools shown per plan and per light |

## **M09 — Adapt**

### **US-M09-01 · Change the conditions, not me**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S23 | **Rules:** Tab 7 | **Priority:** Must | **Sprint:** S8 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** options to change environment, format, order, scope, pace or communication, **so that** the task fits me instead of me masking to fit it. |

**Acceptance criteria**

  - Adaptation categories: environment, format, sequence, scope, pace, instructions, communication method, stop point.
  - Choosing an adaptation re-runs the engine and returns a new card.
  - Copy never frames masking as an adaptation.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M09-01.1 | [Design] | Adapt screen | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M09-01.2 | [Content] | Adaptation library | Reviewed by Ops/UX for neuro-affirming language |
| US-M09-01.3 | [FE] | Build S23 and re-run | New card shown |
| US-M09-01.4 | [QA] | Re-run test | Test cases written, automated where possible, and passing in CI |

### **US-M09-02 · Use my own ritual for transitions**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S23 → S28 | **Rules:** Pattern 37, MD-3 | **Priority:** Should | **Sprint:** S8 | **Size:** S |

  

|  |
| :-: |
| **As a** Customer, **I want** Adapt to offer my saved ritual when I'm moving between tasks or places, **so that** transitions feel familiar. |

**Acceptance criteria**

  - If I have a saved ritual marked for transitions, Adapt shows it as an option.
  - Choosing it opens the Practice Session (S28) with that ritual.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M09-02.1 | [FE] | Ritual option in Adapt | Visible only when a ritual exists |
| US-M09-02.2 | [BE] | Query user's rituals with 'transition' tag | Returns user's own items only |
| US-M09-02.3 | [QA] | With/without saved ritual tests | Test cases written, automated where possible, and passing in CI |

### **US-M09-03 · Free and Advanced tools in Adapt**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S23 | **Rules:** Tab 6d; ENT-1–ENT-3 | **Priority:** Must | **Sprint:** S8 | **Size:** L |

  

|  |
| :-: |
| **As a** Customer, **I want** free Adapt tools I can always use, and Advanced Adapt tools I can unlock if I want more, **so that** I get real help for free and can choose extra depth that is worth paying for. |

**Acceptance criteria**

  - Free tools: Adaptation library (environment, format, sequence, scope, pace, instructions, communication method); stop points; one-tap re-run of the recommendation.
  - Advanced tools (Plus or institution licence): Personal Adjustment Passport (what helps me at work or study, shareable); reasonable-adjustment request templates (drafted in Express); transition planner using saved rituals; context plans (workplace, exams, travel, events).
  - Free tools are listed first; Advanced tools carry an 'Advanced' text label; locked tiles are hidden in Amber/Red and during distress.
  - A free user tapping an Advanced tile in Green/Yellow/Blue sees a short explanation and S41 with 'Not now'.
  - The Adjustment Passport is the user's own document: if Plus lapses it stays readable and exportable (ENT-6).

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M09-03.1 | [Design] | Adapt tool list with Free and Advanced states (unlocked, locked, hidden) | Frames approved; label readable by screen readers |
| US-M09-03.2 | [Content] | Scripts, audio or templates for the Advanced Adapt tools | Approved by PO; safety review where the tool touches distress |
| US-M09-03.3 | [FE] | Build Advanced Adapt tools behind the entitlement check | Locked for Free users; unlocked instantly after purchase |
| US-M09-03.4 | [BE] | Entitlement check on every Advanced tool endpoint | Server refuses Advanced content without entitlement |
| US-M09-03.5 | [QA] | Free vs Plus vs institution-licence tests for Adapt | Correct tools shown per plan and per light |

## **M10 — Connect**

### **US-M10-01 · Reach someone on my terms**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S24 | **Rules:** Tab 7 | **Priority:** Must | **Sprint:** S8 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to contact a trusted person with a one-tap or async message, **so that** I feel less alone without the pressure of a call. |

**Acceptance criteria**

  - Trusted contacts from my Support Plan; async/text is the default.
  - One-tap pre-written messages are editable before sending.
  - Connect is not offered as primary during social hangover.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M10-01.1 | [Design] | Connect screen | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M10-01.2 | [FE] | Build S24 with device share sheet | Message opens in my chosen app |
| US-M10-01.3 | [BE] | Contact and message template storage | Encrypted |
| US-M10-01.4 | [QA] | Social-hangover exclusion test | Test cases written, automated where possible, and passing in CI |

### **US-M10-02 · Community and faith groups I have listed**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S24 | **Rules:** MD-3 | **Priority:** Could | **Sprint:** S8 | **Size:** S |

  

|  |
| :-: |
| **As a** Customer, **I want** to see groups I have added, including faith groups, **so that** I can find community when I want it. |

**Acceptance criteria**

  - Only groups the user has added are shown; Nuccess never suggests a faith group from profile data.
  - Meditate can hand off to Connect when the user wants to practise with others.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M10-02.1 | [FE] | Group list and add/edit | Behaves as described in the acceptance criteria on mobile and web |
| US-M10-02.2 | [BE] | Group storage | User-owned only |
| US-M10-02.3 | [QA] | No profile-driven suggestion test | Test cases written, automated where possible, and passing in CI |

### **US-M10-03 · Free and Advanced tools in Connect**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S24 | **Rules:** Tab 6d; ENT-1–ENT-3 | **Priority:** Must | **Sprint:** S8 | **Size:** L |

  

|  |
| :-: |
| **As a** Customer, **I want** free Connect tools I can always use, and Advanced Connect tools I can unlock if I want more, **so that** I get real help for free and can choose extra depth that is worth paying for. |

**Acceptance criteria**

  - Free tools: Trusted contacts; one-tap pre-written messages; async messaging via the device; groups the user has listed (including faith or community groups).
  - Advanced tools (Plus or institution licence): Moderated peer community spaces; scheduled check-in buddy; human body-doubling rooms (shared with Execute); hosted group sessions.
  - Free tools are listed first; Advanced tools carry an 'Advanced' text label; locked tiles are hidden in Amber/Red and during distress.
  - A free user tapping an Advanced tile in Green/Yellow/Blue sees a short explanation and S41 with 'Not now'.
  - Trusted contacts and one-tap messages are always free (ENT-2).

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M10-03.1 | [Design] | Connect tool list with Free and Advanced states (unlocked, locked, hidden) | Frames approved; label readable by screen readers |
| US-M10-03.2 | [Content] | Scripts, audio or templates for the Advanced Connect tools | Approved by PO; safety review where the tool touches distress |
| US-M10-03.3 | [FE] | Build Advanced Connect tools behind the entitlement check | Locked for Free users; unlocked instantly after purchase |
| US-M10-03.4 | [BE] | Entitlement check on every Advanced tool endpoint | Server refuses Advanced content without entitlement |
| US-M10-03.5 | [Safety] | Moderation policy and safeguarding for peer spaces | Signed by Clinical Safety Director before launch |
| US-M10-03.6 | [QA] | Free vs Plus vs institution-licence tests for Connect | Correct tools shown per plan and per light |

## **M11 — Reflect (NEW)**

### **US-M11-01 · A short, guided reflection**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S25 | **Rules:** RF-3, patterns 33–35 | **Priority:** Must | **Sprint:** S9 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** three gentle prompts I can answer with chips, voice or a few words, **so that** I can make sense of what happened without going round in circles. |

**Acceptance criteria**

  - Variants: 3-prompt check-out, What helped, Pattern review, Self-advocacy prep, Gratitude note, End-of-day close.
  - Exactly three prompts; a visible timer (default 5 min); Stop anytime with no penalty.
  - The session ends with one takeaway in my own words.
  - No streaks, scores or reminders to 'reflect more'.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M11-01.1 | [Design] | Reflect screen: prompt cards, chips, voice, timer, takeaway | Usability-tested with 5 users |
| US-M11-01.2 | [Content] | Prompt sets for each variant, non-judgemental and future-focused | Clinical Safety Director review recorded |
| US-M11-01.3 | [FE] | Build S25 with chips/voice/text and timer | Stop goes to S30 |
| US-M11-01.4 | [BE] | ReflectionEntry {variant, answers, takeaway, topic_tag, saved} | Stored encrypted |
| US-M11-01.5 | [QA] | Timer, stop and three-prompt limit tests | Test cases written, automated where possible, and passing in CI |

### **US-M11-02 · Reflect only when it is safe**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S13, S25 | **Rules:** RF-1, RF-2, pattern 40 | **Priority:** Must | **Sprint:** S9 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** Reflect offered only when I'm steady enough, and stopped if I'm going over the same thing, **so that** reflection helps instead of feeding rumination. |

**Acceptance criteria**

  - Green, Blue: Reflect can be primary. Yellow: only if intensity is Mild or Moderate. Amber: 'Save for later'. Red: not offered.
  - Rumination guard: same topic 3+ times in 7 days without improvement, a worse re-check after the last Reflect, or a rumination emotion → Reflect is replaced by Dump or Regulate with copy 'Let's get it out of your head instead of going over it'.
  - 'Save for later' creates a gentle reminder for the next Green/Blue check-in, never a push in Amber.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M11-02.1 | [BE] | RF-1/RF-2 checks in the gate layer (shared with M04-04) | Unit tests pass |
| US-M11-02.2 | [FE] | Save-for-later state on S13 and S25 entry guard | Guard shown when Reflect is opened directly from a menu |
| US-M11-02.3 | [Content] | Guard and save-for-later copy | Copy approved by PO; plain language; no clinical or diagnostic terms |
| US-M11-02.4 | [QA] | Scenarios RF.6–RF.8 and GD.1 | Test cases written, automated where possible, and passing in CI |

### **US-M11-03 · My Patterns: what helps me**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S26 | **Rules:** RF-4 | **Priority:** Should | **Sprint:** S9 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to save a takeaway and see my own 'what helps me' list, **so that** I can remember and share what works for me. |

**Acceptance criteria**

  - Saving is optional at the end of each reflection.
  - My Patterns shows saved reflections, a 'what helps me' list and pattern cards in plain words.
  - Everything is private by default, never shown to institutions, and can be deleted one by one or all at once.
  - Pattern prompts can be switched off.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M11-03.1 | [Design] | My Patterns layout | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M11-03.2 | [FE] | Build S26 with delete | Delete removes from server |
| US-M11-03.3 | [BE] | Pattern card generator (counts only, no diagnosis) | Outputs plain-language cards |
| US-M11-03.4 | [QA] | Privacy test: no Reflect data in S38/S39 or exports to institutions | Test cases written, automated where possible, and passing in CI |

### **US-M11-04 · Safety screening of reflections**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Clinical Safety Director | **Screens:** S25, S31 | **Rules:** RF-5, M14 | **Priority:** Must | **Sprint:** S9 | **Size:** S |

  

|  |
| :-: |
| **As a** Clinical Safety Director, **I want** all Reflect free text checked by the safety classifier, **so that** a person disclosing risk is offered support immediately. |

**Acceptance criteria**

  - Every Reflect answer passes the Safety screen before saving.
  - A hit pauses Reflect and opens Help/SOS with fixed copy.
  - The hit is logged without storing the free text in analytics.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M11-04.1 | [BE] | Call shared safety classifier on Reflect text | Latency within budget |
| US-M11-04.2 | [FE] | Pause-and-support interaction | Approved by Clinical Safety Director |
| US-M11-04.3 | [QA] | Safety test set run against Reflect | Test cases written, automated where possible, and passing in CI |

### **US-M11-05 · From reflection to action**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S25 → S19 / S23 | **Rules:** Pattern 35 | **Priority:** Should | **Sprint:** S9 | **Size:** S |

  

|  |
| :-: |
| **As a** Customer, **I want** to take my reflection into a message or an adjustment, **so that** I can speak up or change things based on what I learnt. |

**Acceptance criteria**

  - At the end of Self-advocacy prep, 'Turn this into a message' opens Express with my points.
  - 'Change something next time' opens Adapt with the takeaway.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M11-05.1 | [FE] | Hand-off buttons | Visible on relevant variants only |
| US-M11-05.2 | [BE] | Hand-off payload (reuse M07-02) | Behaves as described in the acceptance criteria on mobile and web |
| US-M11-05.3 | [QA] | Scenario RF.5 | Test cases written, automated where possible, and passing in CI |

### **US-M11-07 · Free and Advanced tools in Reflect**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S25, S26 | **Rules:** Tab 6d; ENT-1–ENT-3 | **Priority:** Must | **Sprint:** S9 | **Size:** L |

  

|  |
| :-: |
| **As a** Customer, **I want** free Reflect tools I can always use, and Advanced Reflect tools I can unlock if I want more, **so that** I get real help for free and can choose extra depth that is worth paying for. |

**Acceptance criteria**

  - Free tools: 3-prompt check-out; gratitude note; end-of-day close; save takeaways to My Patterns (list view).
  - Advanced tools (Plus or institution licence): What helped insights; Pattern review with plain-language trend cards; Self-advocacy prep with hand-off to Express; monthly reflection summary; export reflections into a report.
  - Free tools are listed first; Advanced tools carry an 'Advanced' text label; locked tiles are hidden in Amber/Red and during distress.
  - A free user tapping an Advanced tile in Green/Yellow/Blue sees a short explanation and S41 with 'Not now'.
  - RF-1 to RF-5 apply identically to Free and Plus; paying never unlocks Reflect when a gate blocks it (ENT-5).

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M11-07.1 | [Design] | Reflect tool list with Free and Advanced states (unlocked, locked, hidden) | Frames approved; label readable by screen readers |
| US-M11-07.2 | [Content] | Scripts, audio or templates for the Advanced Reflect tools | Approved by PO; safety review where the tool touches distress |
| US-M11-07.3 | [FE] | Build Advanced Reflect tools behind the entitlement check | Locked for Free users; unlocked instantly after purchase |
| US-M11-07.4 | [BE] | Entitlement check on every Advanced tool endpoint | Server refuses Advanced content without entitlement |
| US-M11-07.5 | [QA] | Free vs Plus vs institution-licence tests for Reflect | Correct tools shown per plan and per light |

## **M12 — Meditate · Rituals · Prayer (NEW)**

### **US-M12-01 · Choose a practice that fits where I am**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S27 | **Rules:** MD-4 | **Priority:** Must | **Sprint:** S9 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** one place for meditation, my rituals and my prayer, **so that** I can find stillness or keep my practice in a way that suits my setting. |

**Acceptance criteria**

  - Three tabs: Meditate (stillness timer, guided settle 3/5/10/20 min, gratitude, walking, body scan opt-in), Rituals (my opening/closing/transition rituals), Prayer (my own schedule, texts or audio).
  - Public, formal, observed or caring settings show silent, eyes-open, headphone, ≤3-minute options; spoken prayer only in private or a prayer room.
  - UI label is 'Meditate'; tab labels are neutral.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M12-01.1 | [Design] | S27 with three tabs and length picker | Reviewed with faith and neurodivergent user groups |
| US-M12-01.2 | [FE] | Build S27 with context filter | Filter matches MD-4 |
| US-M12-01.3 | [BE] | Practice list endpoint (user's own + neutral library) | Never returns content selected from profile data |
| US-M12-01.4 | [QA] | Public filter tests MD.6–MD.7 | Test cases written, automated where possible, and passing in CI |

### **US-M12-02 · Practice session**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S28 | **Rules:** MD-5 | **Priority:** Must | **Sprint:** S9 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** a timer or guided audio with an eyes-open option and no interruptions, **so that** I can practise without distraction and stop whenever I want. |

**Acceptance criteria**

  - Timer or audio; eyes-open variant always available.
  - 'In practice' mode pauses Nuccess notifications for the session.
  - End or Stop goes to Feedback (S30).

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M12-02.1 | [Design] | Session states | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M12-02.2 | [FE] | Build S28 incl. background audio | Works with screen locked |
| US-M12-02.3 | [BE] | PracticeSession {practice_id, length, completed, stopped_at, context} | Record saved, linked to the check-in and covered by unit tests |
| US-M12-02.4 | [QA] | Notification pause test | Test cases written, automated where possible, and passing in CI |

### **US-M12-03 · Add my own practices**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S29 | **Rules:** MD-3, MD-5 | **Priority:** Must | **Sprint:** S9 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to add my own ritual, prayer, recitation or schedule, **so that** Nuccess supports my practice instead of choosing one for me. |

**Acceptance criteria**

  - I can add steps for a ritual, a prayer or recitation as text, audio or link, and a recurring schedule (TR).
  - I can mark 'helps me when I'm struggling' and 'meditation makes me feel worse'.
  - All items are private and deletable.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M12-03.1 | [Design] | My Practices editor | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M12-03.2 | [FE] | Build S29 | Audio upload works |
| US-M12-03.3 | [BE] | Practice and UserPracticeFlags storage; recurring rules | Encrypted; TR rule stored |
| US-M12-03.4 | [QA] | Flag effects on engine (MD-2) | Test cases written, automated where possible, and passing in CI |

### **US-M12-04 · Meditate only when it is safe for me**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S13, S27 | **Rules:** MD-1, MD-2, pattern 41 | **Priority:** Must | **Sprint:** S9 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** Meditate not pushed when it could make me feel worse, **so that** stillness practices help rather than harm. |

**Acceptance criteria**

  - MD-1: primary in Green, Yellow, Blue, and in Amber when calm. Amber with distress: Regulate first, Meditate as a ≤3-min eyes-open or saved-practice alternative. Red: user-initiated alternative only; support visible.
  - MD-2: no eyes-closed or body-scan primary during shutdown, feeling detached/unreal, High+ sensory overload, or when the user has flagged meditation makes them worse.
  - Blocked cases fall back to Regulate (Ground/Move) with copy that does not blame the user.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M12-04.1 | [BE] | MD-1/MD-2 in gate layer (shared with M04-04) | Unit tests pass |
| US-M12-04.2 | [Safety] | Clinical Safety Director sign-off of contraindication list | Signed |
| US-M12-04.3 | [QA] | Scenarios MD.8–MD.11 and GD.2–GD.3 | Test cases written, automated where possible, and passing in CI |

### **US-M12-05 · Faith-neutral by design**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S27–S29 | **Rules:** MD-3 | **Priority:** Must | **Sprint:** S9 | **Size:** S |

  

|  |
| :-: |
| **As a** Customer, **I want** Nuccess never to choose religious content for me, **so that** my beliefs are respected and my data is not used against my wishes. |

**Acceptance criteria**

  - Content comes only from My Practices or the approved neutral library.
  - Religion or belief in a profile is never used to select, rank or suggest content.
  - Practice data is never shown in institution views.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M12-05.1 | [BE] | Remove any profile field from practice selection inputs | Code review confirms |
| US-M12-05.2 | [Content] | Neutral library copy review | Reviewed by faith and neurodivergent user groups |
| US-M12-05.3 | [QA] | Privacy and neutrality tests | Test cases written, automated where possible, and passing in CI |

### **US-M12-06 · Gentle reminders for recurring practices**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S35, S05 | **Rules:** MD-5, Tab 4 (TR) | **Priority:** Should | **Sprint:** S9 | **Size:** S |

  

|  |
| :-: |
| **As a** Customer, **I want** reminders for my practices that respect quiet hours and worship time, without streaks, **so that** I keep my practice without guilt. |

**Acceptance criteria**

  - Recurring practices create reminders tuned to my capacity (fewer in Amber/Red).
  - Quiet hours and 'In worship' mode suppress all Nuccess notifications.
  - Missed practices are never shown as failures; no streak counters.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M12-06.1 | [BE] | TR scheduler integrated with notification service | Respects quiet hours |
| US-M12-06.2 | [FE] | Practice-due card on Home | Gentle copy |
| US-M12-06.3 | [QA] | Reminder suppression tests | Test cases written, automated where possible, and passing in CI |

### **US-M12-07 · Neutral practice library**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Product Owner | **Screens:** S27 | **Rules:** MD-3 | **Priority:** Must | **Sprint:** S9 | **Size:** M |

  

|  |
| :-: |
| **As a** Product Owner, **I want** a small approved library of neutral practices, **so that** users without their own practice can still find stillness. |

**Acceptance criteria**

  - Library v1: stillness timer, guided settle (3/5/10/20), gratitude, walking practice, body scan (opt-in), eyes-open versions.
  - Each item has a length, eyes-open flag, public-safe flag and audio.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M12-07.1 | [Content] | Scripts and audio recording | Approved by PO |
| US-M12-07.2 | [Safety] | Clinical review of scripts | Signed |
| US-M12-07.3 | [Data] | Load library with metadata | Visible in S27 |

### **US-M12-08 · Free and Advanced tools in Meditate · Rituals · Prayer**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S27–S29 | **Rules:** Tab 6d; ENT-1–ENT-3 | **Priority:** Must | **Sprint:** S9 | **Size:** L |

  

|  |
| :-: |
| **As a** Customer, **I want** free Meditate · Rituals · Prayer tools I can always use, and Advanced Meditate · Rituals · Prayer tools I can unlock if I want more, **so that** I get real help for free and can choose extra depth that is worth paying for. |

**Acceptance criteria**

  - Free tools: Stillness timer; guided settle (3 and 5 min); gratitude practice; eyes-open versions; the user's OWN rituals, prayers, recitations, schedules and reminders (unlimited); 'In worship' mode.
  - Advanced tools (Plus or institution licence): Full guided library (10 and 20 min, walking practice, body-scan series); multi-step ritual builder with audio and timers; recitation player (loops, offline, own audio upload); themed programmes (exam season, transitions, sleep); practice insights.
  - Free tools are listed first; Advanced tools carry an 'Advanced' text label; locked tiles are hidden in Amber/Red and during distress.
  - A free user tapping an Advanced tile in Green/Yellow/Blue sees a short explanation and S41 with 'Not now'.
  - The user's own rituals, prayers, recitations, schedules and reminders are free and unlimited (ENT-4).
  - MD-1 to MD-6 apply identically to Free and Plus.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M12-08.1 | [Design] | Meditate · Rituals · Prayer tool list with Free and Advanced states (unlocked, locked, hidden) | Frames approved; label readable by screen readers |
| US-M12-08.2 | [Content] | Scripts, audio or templates for the Advanced Meditate · Rituals · Prayer tools | Approved by PO; safety review where the tool touches distress |
| US-M12-08.3 | [FE] | Build Advanced Meditate · Rituals · Prayer tools behind the entitlement check | Locked for Free users; unlocked instantly after purchase |
| US-M12-08.4 | [BE] | Entitlement check on every Advanced tool endpoint | Server refuses Advanced content without entitlement |
| US-M12-08.5 | [QA] | Free vs Plus vs institution-licence tests for Meditate · Rituals · Prayer | Correct tools shown per plan and per light |

## **M13 — Feedback, Recovery & Personalisation**

### **US-M13-01 · Did this help? and a gentle re-check**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S30 | **Rules:** Tab 8, Tab 10 | **Priority:** Must | **Sprint:** S10 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to say if it helped and optionally re-check my state, **so that** Nuccess learns and I can see if I'm steadier. |

**Acceptance criteria**

  - Questions: Did this help? (yes / a bit / no), effort, optional re-check.
  - If the re-check improves, the Blue Recovery message is shown and the band rises at most one step per re-check.
  - Skip is always allowed.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M13-01.1 | [Design] | Feedback screen and Blue Recovery card | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M13-01.2 | [FE] | Build S30 | Works for all modules |
| US-M13-01.3 | [BE] | Feedback and re-check storage; recovery calculator | One-step rule enforced |
| US-M13-01.4 | [QA] | Recovery tests | Test cases written, automated where possible, and passing in CI |

### **US-M13-02 · Queued next step**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S30 → S13 | **Rules:** Tab 8 | **Priority:** Must | **Sprint:** S10 | **Size:** S |

  

|  |
| :-: |
| **As a** Customer, **I want** a gentle next step after support if I had a task, **so that** I can return to my demand when ready. |

**Acceptance criteria**

  - After support, if a demand exists, the next card offers the smallest step (Routine first in Blue).
  - In Blue, Reflect or Meditate may be offered as alternatives.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M13-02.1 | [BE] | Queue service | Behaves as described in the acceptance criteria on mobile and web |
| US-M13-02.2 | [FE] | Next-step card | Behaves as described in the acceptance criteria on mobile and web |
| US-M13-02.3 | [QA] | Queue tests | Test cases written, automated where possible, and passing in CI |

### **US-M13-03 · Learn what helps me**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** Engine | **Rules:** NFR-07 | **Priority:** Should | **Sprint:** S10 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** suggestions to improve from my own feedback, **so that** I get more of what works. |

**Acceptance criteria**

  - Only repeated, validated outcomes re-rank tools within the allowed set.
  - Personalisation never overrides bands, gates or safety.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M13-03.1 | [BE] | Re-ranking layer after gates | Gates unaffected (test) |
| US-M13-03.2 | [Data] | Outcome aggregation job | Daily |
| US-M13-03.3 | [QA] | Personalisation cannot unlock blocked pathways | Test cases written, automated where possible, and passing in CI |

## **M14 — Safety & Support**

### **US-M14-01 · Help is always one tap away**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S31 | **Rules:** MD-6, NFR-06 | **Priority:** Must | **Sprint:** S5 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** Help/SOS reachable from every screen, **so that** I can get human support instantly. |

**Acceptance criteria**

  - Fixed, clinically reviewed copy; 999, NHS 111 mental health option, Samaritans 116 123, Shout 85258; trusted contact; institution/GP routes where configured.
  - No AI-generated text on this screen.
  - Reflect or Meditate can never hide or replace this button.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M14-01.1 | [Design] | Help/SOS screen and persistent button | Approved by Clinical Safety Director |
| US-M14-01.2 | [Content] | Fixed copy and numbers | Verified current |
| US-M14-01.3 | [FE] | Build S31 and global button | Visible on all 41 screens |
| US-M14-01.4 | [QA] | Global visibility test | Test cases written, automated where possible, and passing in CI |

### **US-M14-02 · Safety override across free text**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Clinical Safety Director | **Screens:** All free text | **Rules:** RF-5, NFR-06 | **Priority:** Must | **Sprint:** S5 | **Size:** L |

  

|  |
| :-: |
| **As a** Clinical Safety Director, **I want** a single safety classifier for Need, Dump, Express and Reflect text, **so that** risk is detected consistently. |

**Acceptance criteria**

  - Shared classifier service; deterministic escalation rules.
  - Override interrupts any flow and opens S31.
  - Professional review before release; no unsafe reassurance.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M14-02.1 | [BE] | Classifier service + rules | Test set pass rate agreed with Clinical Safety Director |
| US-M14-02.2 | [Safety] | Escalation rule review | Signed |
| US-M14-02.3 | [QA] | Cross-module safety tests | Test cases written, automated where possible, and passing in CI |

### **US-M14-03 · My support plan**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S32 | **Rules:** NFR-05 | **Priority:** Should | **Sprint:** S5 | **Size:** S |

  

|  |
| :-: |
| **As a** Customer, **I want** to save trusted contacts, preferred routes and pre-written messages, **so that** help is ready before I need it. |

**Acceptance criteria**

  - I can add trusted contacts, each with its own consent and preferred channel.
  - I can save pre-written messages ('I'm struggling, can you call me?') and edit them before sending.
  - The plan feeds Help/SOS (S31) and Connect (S24); nothing is sent without my tap.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M14-03.1 | [Design] | Support Plan editor and contact consent step | Frames approved by PO and Clinical Safety Director |
| US-M14-03.2 | [FE] | Build S32 with add/edit/remove contact and message templates | Saved plan appears on S31 and S24 |
| US-M14-03.3 | [BE] | Encrypted storage for contacts, routes and templates | Data encrypted at rest; only the owner can read it |
| US-M14-03.4 | [QA] | End-to-end: create plan → open S31 → send pre-written message | Message opens in the device app pre-filled |

## **M15 — Progress, Reports & Sharing**

### **US-M15-01 · See my own progress**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S33 | **Rules:** NFR-01 | **Priority:** Should | **Sprint:** S10 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to see trends in my states, what helped and what I completed, **so that** I understand my own patterns. |

**Acceptance criteria**

  - Charts show state trends, pathways used (including Reflect and Meditate) and 'what helped' ratings.
  - Every chart has a plain-text equivalent.
  - No clinical interpretation, streaks or failure framing.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M15-01.1 | [Design] | Progress dashboard with chart + text-summary pairs | Approved; copy free of clinical language |
| US-M15-01.2 | [FE] | Build S33 with accessible charts | Screen reader reads the text summary for each chart |
| US-M15-01.3 | [BE] | Aggregation endpoints (7/30/90 days) | Responses match raw records in spot checks |
| US-M15-01.4 | [QA] | Accessibility and data-accuracy checks | No blocking defects |

### **US-M15-02 · Share a report with a professional**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S34 | **Rules:** NFR-05, NFR-10 | **Priority:** Should | **Sprint:** S10 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to choose dates and record types and share them with a named professional, **so that** I can explain my needs while staying in control. |

**Acceptance criteria**

  - I choose the date range and record types; Reflect and practice data are excluded unless I tick them.
  - The recipient is named; access has an expiry; I can revoke at any time.
  - Every view of the report is logged and visible to me.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M15-02.1 | [Design] | Report builder and share confirmation | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M15-02.2 | [FE] | Build S34 with record selection, preview and revoke | Preview matches what the recipient sees |
| US-M15-02.3 | [BE] | Report generation and share service with expiry/revoke | Revoked links stop working immediately |
| US-M15-02.4 | [QA] | Share, view, revoke and expiry tests | All four behave as specified |

### **US-M15-03 · Receive only what was shared**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Professional / Support Provider | **Screens:** Shared report view | **Rules:** NFR-05, NFR-10 | **Priority:** Should | **Sprint:** S10 | **Size:** S |

  

|  |
| :-: |
| **As a** Professional / Support Provider, **I want** an accessible report containing only what the person chose to share, **so that** I can support them without seeing unrelated private data. |

**Acceptance criteria**

  - The secure link shows only the selected records; recipient identity is recorded.
  - The report is readable with a screen reader and printable.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M15-03.1 | [BE] | Recipient verification and scoped data query | Query cannot return unselected record types (test) |
| US-M15-03.2 | [FE] | Report viewer page | Passes accessibility check; prints cleanly |
| US-M15-03.3 | [QA] | Scope and audit-log tests | Access attempts outside scope are refused and logged |

### **US-M15-04 · Advanced progress and reports**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S33, S34 | **Rules:** Tab 6d (cross-cutting) | **Priority:** Should | **Sprint:** S10 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** full history, cross-pathway insights and detailed reports if I choose Plus, **so that** I can understand myself better and share richer evidence. |

**Acceptance criteria**

  - Free: last 30 days with text summaries; one simple summary shared with a named person.
  - Advanced: full history, insights across pathways, downloadable charts, detailed and scheduled reports, several recipients.
  - If Plus lapses, previously generated reports remain downloadable.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M15-04.1 | [Design] | Free vs Advanced views of S33 and S34 | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M15-04.2 | [BE] | History limits and advanced report generation behind entitlement | Limits enforced server-side |
| US-M15-04.3 | [QA] | Lapse test: old reports still downloadable | Test cases written, automated where possible, and passing in CI |

## **M16 — Settings, Privacy, Consent, Notifications & Plans**

### **US-M16-01 · Control my settings and consent**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S36 | **Rules:** NFR-05 | **Priority:** Must | **Sprint:** S1 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** to change accessibility settings and give or withdraw consent for each data use, **so that** I am in control of my experience and my data. |

**Acceptance criteria**

  - Consent is separate for product improvement, research and institution sharing, and can be withdrawn at any time.
  - Accessibility settings from Quick Setup are editable here.
  - The age and safeguarding notice is shown in plain language.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M16-01.1 | [Design] | Settings & Privacy screen with consent toggles and explanations | Approved by PO; consent copy reviewed |
| US-M16-01.2 | [FE] | Build S36 | Toggles reflect server state after reload |
| US-M16-01.3 | [BE] | Consent records with timestamp and version of the consent text | Withdrawal takes effect in all downstream services |
| US-M16-01.4 | [QA] | Consent give/withdraw tests across analytics and institution views | No data flows after withdrawal |

### **US-M16-02 · Reminders, quiet hours and 'In worship'**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S35 | **Rules:** MD-5 | **Priority:** Must | **Sprint:** S1 | **Size:** S |

  

|  |
| :-: |
| **As a** Customer, **I want** to control notification style, quiet hours and an 'In worship' do-not-disturb, **so that** Nuccess never interrupts me at the wrong time. |

**Acceptance criteria**

  - Quiet hours and 'In worship' suppress all Nuccess notifications, including practice reminders.
  - Task and practice reminders are listed together and can be edited or switched off.
  - Notification style (gentle, standard, silent badge) is respected.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M16-02.1 | [Design] | Reminders & Notifications screen | Frames approved by PO; all states (empty, loading, error, offline) and accessibility notes included |
| US-M16-02.2 | [FE] | Build S35 and the 'In worship' quick toggle on S27 | Toggle state shared between screens |
| US-M16-02.3 | [BE] | Notification service honours quiet hours and 'In worship' | No notification sent inside a suppressed window (test) |
| US-M16-02.4 | [QA] | Suppression tests across time zones | Test cases written, automated where possible, and passing in CI |

### **US-M16-03 · Export, delete and log out**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S36, S40 | **Rules:** NFR-05 | **Priority:** Must | **Sprint:** S1 | **Size:** S |

  

|  |
| :-: |
| **As a** Customer, **I want** to export or delete my data and log out safely, **so that** I can leave whenever I choose. |

**Acceptance criteria**

  - Export produces a readable file of my data.
  - Delete removes personal data according to the retention policy and confirms when done.
  - Log out asks once to confirm and keeps unsynced data safe.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M16-03.1 | [BE] | Export and deletion jobs | Deletion verified across all stores, including backups policy |
| US-M16-03.2 | [FE] | Export/delete controls and S40 | Clear confirmation messages |
| US-M16-03.3 | [QA] | Deletion verification script | No personal records remain after deletion |

### **US-M16-04 · Plans & Advanced Tools screen**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S41 | **Rules:** ENT-3, ENT-6, ENT-8 | **Priority:** Must | **Sprint:** S11 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** one honest screen explaining what is free, what Advanced adds, the price and how to cancel, **so that** I can decide calmly whether to pay. |

**Acceptance criteria**

  - Shows Free vs Advanced for each of the eight pathways in plain words, the price (from configuration), any trial, and 'cancel in two taps'.
  - Reachable from Settings and from an Advanced tile in Green/Yellow/Blue; never opened automatically and never shown in Amber/Red or during a session.
  - No countdown timers, guilt copy or pre-ticked boxes; 'Not now' is as visible as 'Upgrade'.
  - Shows institution-licence status when the user is covered; manage, cancel and restore purchase are available.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M16-04.1 | [Design] | S41 layout, purchase confirmation and manage/cancel states | Approved by PO; reviewed against consumer-protection guidance |
| US-M16-04.2 | [Content] | Plain-language plan descriptions and pricing copy | Legal review complete |
| US-M16-04.3 | [FE] | Build S41 with app-store and web purchase flows | Purchase, restore and cancel work on iOS, Android and web |
| US-M16-04.4 | [QA] | Check S41 never appears in Amber/Red or mid-session | Test cases written, automated where possible, and passing in CI |

## **M17 — Admin Console & Rules Configuration**

### **US-M17-01 · Role-based admin access**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** NUCCESS Admin | **Screens:** S37 | **Rules:** NFR-04, NFR-10 | **Priority:** Must | **Sprint:** S11 | **Size:** M |

  

|  |
| :-: |
| **As a** NUCCESS Admin, **I want** separate admin roles with the least access needed, **so that** only the right people can change the right things. |

**Acceptance criteria**

  - Roles: Super Admin, Content Editor, Rules Editor, Safety Reviewer, Analyst, Institution Manager.
  - Every admin action is written to the audit log.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M17-01.1 | [BE] | RBAC model and permission checks on every admin endpoint | Permission matrix enforced server-side |
| US-M17-01.2 | [FE] | Admin shell with role-aware navigation | Users see only their permitted areas |
| US-M17-01.3 | [QA] | Permission matrix tests (role × action) | All forbidden actions return a refusal and an audit entry |

### **US-M17-02 · Configure rules and content safely**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** NUCCESS Admin | **Screens:** S37 | **Rules:** NFR-08, Tab 7, Tab 6c | **Priority:** Must | **Sprint:** S11 | **Size:** L |

  

|  |
| :-: |
| **As a** NUCCESS Admin, **I want** to change rules and content through draft → review → approve, **so that** changes are safe, reversible and traceable. |

**Acceptance criteria**

  - Patterns, gates, thresholds, copy and the practice library are versioned.
  - Changes to safety rules (RF, MD, safety override) need Safety Reviewer approval before publishing.
  - Rollback to the previous version is one action.
  - The Rules Engine workbook (v3.2 format) can be imported.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M17-02.1 | [BE] | Config versioning, approval workflow and rollback | Published version stamped on every recommendation |
| US-M17-02.2 | [FE] | Rules and content editor with diff view | Reviewer sees exactly what changed |
| US-M17-02.3 | [Data] | Workbook importer for Tabs 1, 2, 4, 6, 6b, 6c, 7, 10 | Import → export round-trip gives identical rules |
| US-M17-02.4 | [QA] | Approval-path and rollback tests | Unapproved safety changes cannot publish |

### **US-M17-03 · Aggregate analytics**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** NUCCESS Admin | **Screens:** S37 | **Rules:** NFR-14 | **Priority:** Should | **Sprint:** S11 | **Size:** M |

  

|  |
| :-: |
| **As a** NUCCESS Admin, **I want** registered, active and paid users and pathway usage in aggregate, **so that** we can run and improve the product. |

**Acceptance criteria**

  - Pathway usage covers all eight pathways, including Reflect and Meditate, in aggregate only.
  - Free, trial, Plus, concession and institution-licence counts; conversion by pathway; a fairness check showing zero Advanced prompts in Amber/Red.
  - No personal free text or individual records are shown.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M17-03.1 | [BE] | Aggregate queries from the event pipeline | Numbers reconcile with source data |
| US-M17-03.2 | [FE] | Analytics charts with filters | Approved by PO |
| US-M17-03.3 | [QA] | Privacy check (no free text, no individual drill-down) | Test cases written, automated where possible, and passing in CI |

### **US-M17-04 · Safety and AI monitoring**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Clinical Safety Director | **Screens:** S37 | **Rules:** NFR-06 | **Priority:** Must | **Sprint:** S11 | **Size:** M |

  

|  |
| :-: |
| **As a** Clinical Safety Director, **I want** a dashboard of safety overrides, gate blocks and AI fallbacks, **so that** we can spot and act on problems quickly. |

**Acceptance criteria**

  - Shows counts and trends of safety overrides, RF-2 rumination blocks, MD-2 contraindication blocks and AI fallbacks.
  - Threshold alerts notify the Clinical Safety Director.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M17-04.1 | [BE] | Monitoring metrics and alert rules | Alert fires in test when a threshold is crossed |
| US-M17-04.2 | [FE] | Safety dashboard | Approved by Clinical Safety Director |
| US-M17-04.3 | [QA] | Alert and metric accuracy tests | Test cases written, automated where possible, and passing in CI |

### **US-M17-05 · Manage institutions**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** NUCCESS Admin | **Screens:** S37 | **Rules:** NFR-09 | **Priority:** Should | **Sprint:** S11 | **Size:** S |

  

|  |
| :-: |
| **As a** NUCCESS Admin, **I want** to create institutions, deployments and their settings, **so that** B2B pilots can be set up without engineering help. |

**Acceptance criteria**

  - Create and edit institution, remit, supporter roles and minimum cohort size.
  - Changes are audited.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M17-05.1 | [BE] | Institution and deployment model | Multi-tenant isolation tested |
| US-M17-05.2 | [FE] | Institution admin pages | Matches the approved design and meets every acceptance criterion |
| US-M17-05.3 | [QA] | Tenant isolation tests | No cross-tenant data visible |

### **US-M17-06 · Configure plans and tool tiers**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** NUCCESS Admin | **Screens:** S37 | **Rules:** ENT-9, NFR-08 | **Priority:** Must | **Sprint:** S11 | **Size:** M |

  

|  |
| :-: |
| **As a** NUCCESS Admin, **I want** to manage plans, prices and which tools are Free or Advanced without a release, **so that** the business model can change safely. |

**Acceptance criteria**

  - Plans, prices, trial length and concession rules are configuration with draft → review → approve.
  - Moving a tool between tiers needs PO approval; Safety Reviewer approval is also required for Regulate, Connect, communication cards and any safety-floor tool.
  - Validation blocks publishing if any pathway would lose its free tools for any light or context (ENT-1).

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M17-06.1 | [BE] | Plan and tier configuration with approval workflow | Unapproved changes cannot publish |
| US-M17-06.2 | [FE] | Tier editor showing each pathway's Free and Advanced columns | Matches the approved design and meets every acceptance criterion |
| US-M17-06.3 | [Data] | Import tiers from workbook Tab 6d | Round-trip matches |
| US-M17-06.4 | [QA] | ENT-1 validation and approval-path tests | Test cases written, automated where possible, and passing in CI |

## **M18 — Institution (CAAM)**

### **US-M18-01 · Aggregate institution dashboard**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Institution Supporter | **Screens:** S38 | **Rules:** NFR-05 | **Priority:** Should | **Sprint:** S12 | **Size:** M |

  

|  |
| :-: |
| **As an** Institution Supporter, **I want** aggregate trends for my remit, **so that** I can plan support without seeing anyone's private data. |

**Acceptance criteria**

  - Minimum cohort size is enforced; small groups are hidden.
  - Reflect content, My Patterns and practice data are never shown.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M18-01.1 | [Design] | Institution dashboard | Reviewed with a pilot institution |
| US-M18-01.2 | [FE] | Build S38 with filters | Matches the approved design and meets every acceptance criterion |
| US-M18-01.3 | [BE] | Aggregation with cohort threshold and exclusions | Excluded data types cannot be queried |
| US-M18-01.4 | [QA] | Cohort threshold and exclusion tests | Test cases written, automated where possible, and passing in CI |

### **US-M18-02 · Consent-scoped user summary**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Institution Supporter | **Screens:** S39 | **Rules:** NFR-05, NFR-10 | **Priority:** Should | **Sprint:** S12 | **Size:** M |

  

|  |
| :-: |
| **As an** Institution Supporter, **I want** to see trends for people who opted in and to request outreach, **so that** I can offer timely support. |

**Acceptance criteria**

  - Only opted-in users appear; trends and flags only; every view is logged.
  - An outreach request goes to the user, who chooses whether to accept.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M18-02.1 | [FE] | Build S39 and the outreach request flow | Matches the approved design and meets every acceptance criterion |
| US-M18-02.2 | [BE] | Consent check on every request and access log | Access without consent is refused |
| US-M18-02.3 | [QA] | Consent and audit tests | Test cases written, automated where possible, and passing in CI |

### **US-M18-03 · Opt in or out of institution sharing**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S36 | **Rules:** NFR-05 | **Priority:** Must | **Sprint:** S12 | **Size:** S |

  

|  |
| :-: |
| **As a** Customer, **I want** to choose what my institution can see and withdraw at any time, **so that** sharing stays my decision. |

**Acceptance criteria**

  - Opt-in is per institution and per data type.
  - Withdrawal removes access immediately.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M18-03.1 | [FE] | Institution consent controls in S36 | Clear explanation of what is shared |
| US-M18-03.2 | [BE] | Consent workflow and immediate revocation | Revocation reflected in S39 within one refresh |
| US-M18-03.3 | [QA] | Opt-in / revoke tests | Test cases written, automated where possible, and passing in CI |

## **M19 — Platform, Integrations, Security & Data**

### **US-M19-01 · Environments and delivery pipeline**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Developer | **Screens:** Backend | **Rules:** NFR-04, NFR-12 | **Priority:** Must | **Sprint:** S0 | **Size:** M |

  

|  |
| :-: |
| **As a** Developer, **I want** dev, test, staging and production with CI/CD and secret management, **so that** we can ship safely and often. |

**Acceptance criteria**

  - Four separate environments; no secrets in code; automated tests run on every merge.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M19-01.1 | [BE] | Infrastructure as code for all environments | Environments reproducible from scripts |
| US-M19-01.2 | [BE] | CI/CD pipeline with test, lint and security scan stages | Failing tests block the merge |
| US-M19-01.3 | [QA] | Test harness that can load workbook fixtures (Tabs 0, 0b, 9, 10) | Fixtures run in CI |

### **US-M19-02 · Authentication and identity**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Customer | **Screens:** S04 | **Rules:** NFR-04 | **Priority:** Must | **Sprint:** S0 | **Size:** M |

  

|  |
| :-: |
| **As a** Customer, **I want** secure sign-in with email or an identity provider, **so that** my account is safe. |

**Acceptance criteria**

  - Secure sessions, password reset, account lockout; institution SSO can be added later.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M19-02.1 | [BE] | Auth service and session management | Passes security review checklist |
| US-M19-02.2 | [FE] | Auth screens wired to S04 | Error messages are plain-language |
| US-M19-02.3 | [QA] | Auth security tests | No high/critical findings |

### **US-M19-03 · Core data model**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Developer | **Screens:** Backend | **Rules:** NFR-11 | **Priority:** Must | **Sprint:** S0 | **Size:** M |

  

|  |
| :-: |
| **As a** Developer, **I want** one agreed data model with migrations, **so that** every module works from the same truth. |

**Acceptance criteria**

  - Entities: User, Preferences, CheckIn, Experience, Sensation, Context, Need, Demand, Recommendation, Session, Feedback, DumpEntry, ReflectionEntry, Practice, PracticeSession, UserPracticeFlags, Consent, Contact, Report, Institution, AuditLog.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M19-03.1 | [Data] | Schema, relations and migrations | Reviewed by Tech Lead; migrations reversible |
| US-M19-03.2 | [BE] | Repository layer and encryption for sensitive fields | Sensitive fields encrypted at rest |
| US-M19-03.3 | [QA] | Referential-integrity tests | Test cases written, automated where possible, and passing in CI |

### **US-M19-04 · Analytics event pipeline**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Developer | **Screens:** Backend | **Rules:** NFR-14 | **Priority:** Should | **Sprint:** S0 | **Size:** M |

  

|  |
| :-: |
| **As a** Developer, **I want** events that keep operational analytics separate from research data, **so that** we measure what matters without over-collecting. |

**Acceptance criteria**

  - Event catalogue in section 14 implemented; research datasets only with consent; no free text in events.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M19-04.1 | [Data] | Event schema and catalogue | Catalogue matches section 14 |
| US-M19-04.2 | [BE] | Event pipeline with consent filter | Events without research consent never reach the research store |
| US-M19-04.3 | [QA] | Consent-gating test | Test cases written, automated where possible, and passing in CI |

### **US-M19-05 · AI service layer with graceful fallback**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Developer | **Screens:** Backend | **Rules:** NFR-03, NFR-13 | **Priority:** Must | **Sprint:** S0 | **Size:** M |

  

|  |
| :-: |
| **As a** Developer, **I want** all AI calls behind one service with timeouts and fallbacks, **so that** the app still works when AI does not. |

**Acceptance criteria**

  - Provider-agnostic interface; the deterministic engine and safety rules never depend on AI.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M19-05.1 | [BE] | AI gateway with timeout, retry and fallback | Simulated outage keeps core flows working |
| US-M19-05.2 | [QA] | Fallback tests for Dump, Express, Execute | Test cases written, automated where possible, and passing in CI |

### **US-M19-06 · Scoped third-party integrations**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Third-Party Integration Company | **Screens:** Backend | **Rules:** NFR-04, NFR-05 | **Priority:** Could | **Sprint:** S12 | **Size:** M |

  

|  |
| :-: |
| **As a** Third-Party Integration Company, **I want** a scoped integration contract, **so that** only permitted data is exchanged. |

**Acceptance criteria**

  - Explicit OAuth/API scopes, minimum fields and secure token lifecycle.
  - With consent, calendar events can pre-fill Demand & Timeline.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M19-06.1 | [BE] | Integration registry, scopes and token lifecycle | Tokens rotate and can be revoked |
| US-M19-06.2 | [BE] | Calendar connector (read-only) | Events appear as suggestions, never auto-added |
| US-M19-06.3 | [QA] | Security review of integrations | No high/critical findings |

### **US-M19-07 · Payments and entitlement service**

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Role:** Third-Party Integration Company | **Screens:** Backend, S41 | **Rules:** ENT-6, ENT-7, ENT-8; NFR-04 | **Priority:** Must | **Sprint:** S11 | **Size:** L |

  

|  |
| :-: |
| **As a** Third-Party Integration Company, **I want** a secure, scoped connection to app-store and web payment providers, **so that** subscriptions are reliable and Nuccess never stores card data. |

**Acceptance criteria**

  - Supports app-store subscriptions (iOS, Android) and a web payment provider; receipts verified server-side.
  - Entitlement states: trial, active, grace, lapsed, cancelled; institution licences grant Plus to covered users.
  - Lapse locks Advanced tools only; user content is never deleted or hidden.
  - Billing events are logged; no card data stored by Nuccess.

**Child issues**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| **ID** | **Type** | **Task** | **Done when** |
| US-M19-07.1 | [BE] | Entitlement service and receipt verification | Entitlement updates within one minute of purchase |
| US-M19-07.2 | [BE] | Institution licence seats and assignment | Covered users unlocked; institution sees no extra individual data |
| US-M19-07.3 | [Data] | Plan, Entitlement and BillingEvent tables | Migrations reviewed |
| US-M19-07.4 | [QA] | Purchase, renew, cancel, refund, lapse and restore tests in sandbox | All pass |

# **11. Scrum delivery plan**

## **11.1 Scrum roles**

|  |  |
| :-: | :-: |
| **Role** | **Responsibility** |
| Product Owner (Founder) | Vision, backlog priority, acceptance criteria, core IP, final acceptance. |
| Engineering Lead | Architecture, technical breakdown, estimates, code quality, delivery. |
| Product Designer | UX/UI, accessibility, design system, prototypes, usability testing, design QA. |
| Clinical Safety Director | Safety rules (incl. RF and MD gates), sensitive copy, escalation logic, responsible AI. |
| Operations / UX / Partnerships | User research (including faith and neurodivergent user groups), institutional discovery, pilot feedback. |
| Developers & QA | Implementation, tests, integration, defects, release readiness. |

## **11.2 Definition of Ready**

  - Story has role, need, outcome and testable acceptance criteria.
  - Screens and rule references are linked (workbook tab, pattern, gate).
  - Design frames exist for UI stories, or a \[Design\] child issue is in the same sprint ahead of \[FE\].
  - Safety-related stories have a named Clinical Safety reviewer.
  - Dependencies are known and not blocked.

## **11.3 Definition of Done**

  - All acceptance criteria met and demonstrated in staging.
  - Code reviewed; unit and integration tests pass in CI; relevant workbook fixtures pass.
  - Accessibility checked (screen reader, 200% text, reduced motion, contrast).
  - Analytics events from section 14 implemented with no free text.
  - Copy approved; safety sign-off recorded where required.
  - PO accepts the story.

## **11.4 Sprint plan (two-week sprints)**

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| **Sprint** | **Goal** | **Scope** | **Stories** | **Sprint exit (demo)** |
| S0 | Foundations | Environments, CI/CD, auth, data model, AI layer, event pipeline | US-M19-01, US-M19-02, US-M19-03, US-M19-04, US-M19-05 | Empty app deploys to staging; fixtures run in CI |
| S1 | Front door | Welcome, setup, sign-up, Home; settings, consent, notifications | US-M01-01, US-M01-02, US-M01-03, US-M01-04, US-M16-01, US-M16-02, US-M16-03, US-M01-05 | A user can sign up, set comfort settings and land on Home |
| S2 | Check-in | Capacity Matrix, Not sure, emotions, sensations, context | US-M02-01, US-M02-02, US-M02-03, US-M03-01, US-M03-02, US-M03-03 | A full check-in is stored with state name shown |
| S3 | Need, demand and bands | Need, Demand & Timeline, band calculator | US-M04-01, US-M04-02, US-M04-03 | Engine returns band and light for all Tab 10 fixtures |
| S4 | Recommendation engine | Patterns 1–41, gates, NUCRIPCE, card, decision log | US-M04-04, US-M04-05, US-M04-06, US-M04-07, US-M04-08 | S13 shows the right card for Tab 0/0b fixtures |
| S5 | Regulate and safety | Regulate; Help/SOS; safety classifier; support plan | US-M05-01, US-M05-02, US-M14-01, US-M14-02, US-M14-03, US-M05-03 | Red and Amber journeys work end to end with Help visible |
| S6 | Dump and Express | Capture, review, Express tools, send later | US-M06-01, US-M06-02, US-M07-01, US-M07-02, US-M06-03, US-M07-03 | A user can dump, sort and draft a message |
| S7 | Execute | Task list, breakdown, focus, body double | US-M08-01, US-M08-02, US-M08-03, US-M08-04 | Task journey works for T0–TX |
| S8 | Adapt and Connect | Adaptations, transition ritual hook, contacts and groups | US-M09-01, US-M09-02, US-M10-01, US-M10-02, US-M09-03, US-M10-03 | Adapt re-runs the engine; Connect sends via device apps |
| S9 | Reflect and Meditate | M11 Reflect and M12 Meditate · Rituals · Prayer, including gates and library | US-M11-01, US-M11-02, US-M11-03, US-M11-04, US-M11-05, US-M12-01, US-M12-02, US-M12-03, US-M12-04, US-M12-05, US-M12-06, US-M12-07, US-M11-07, US-M12-08 | Scenarios RF.1–RF.8, MD.1–MD.11, GD.1–GD.3 pass; safety sign-off |
| S10 | Feedback and progress | Feedback, Blue Recovery, personalisation, progress, reports | US-M13-01, US-M13-02, US-M13-03, US-M15-01, US-M15-02, US-M15-03, US-M15-04 | Loop closes: recommendation → feedback → recovery → next step |
| S11 | Admin, plans and payments | RBAC, rules/content and tier config, analytics, safety monitoring, institutions, S41 and payments | US-M17-01, US-M17-02, US-M17-03, US-M17-04, US-M17-05, US-M16-04, US-M17-06, US-M19-07 | Rules and tiers can be changed and approved without a release; a test purchase unlocks Advanced tools |
| S12 | Institutions and integrations | CAAM dashboards, consent, calendar integration | US-M18-01, US-M18-02, US-M18-03, US-M19-06 | Pilot institution can see aggregate data only |
| S13 | Hardening and release | Accessibility audit, security test, performance, clinical safety case, beta | Cross-module hardening | Release candidate approved by PO and Clinical Safety Director |

Sprint 9 is deliberately scheduled after Regulate, Dump, Express and Adapt exist, because Reflect and Meditate hand off to and fall back on them.

# **12. Traceability**

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| **Module** | **Screens** | **Requirements** | **Stories** | **Sprint** |
| M01 Onboarding, Accounts & Home | S01–S05 | FR-M01-01 – FR-M01-05 | M01-01, M01-02, M01-03, M01-04, M01-05 | S1 |
| M02 Check-in: Capacity Matrix | S06–S07 | FR-M02-01 – FR-M02-03 | M02-01, M02-02, M02-03 | S2 |
| M03 Experience & Context | S08–S10 | FR-M03-01 – FR-M03-03 | M03-01, M03-02, M03-03 | S2 |
| M04 Need, Demand & Recommendation Engine | S11–S13 + engine service | FR-M04-01 – FR-M04-09 | M04-01, M04-02, M04-03, M04-04, M04-05, M04-06, M04-07, M04-08 | S3, S4 |
| M05 Regulate | S14–S15 | FR-M05-01 – FR-M05-03 | M05-01, M05-02, M05-03 | S5 |
| M06 Dump | S16–S17 | FR-M06-01 – FR-M06-03 | M06-01, M06-02, M06-03 | S6 |
| M07 Express | S18–S19 | FR-M07-01 – FR-M07-03 | M07-01, M07-02, M07-03 | S6 |
| M08 Execute (Tasks, Focus, Body Double) | S20–S22 | FR-M08-01 – FR-M08-04 | M08-01, M08-02, M08-03, M08-04 | S7 |
| M09 Adapt | S23 | FR-M09-01 – FR-M09-03 | M09-01, M09-02, M09-03 | S8 |
| M10 Connect | S24 | FR-M10-01 – FR-M10-03 | M10-01, M10-02, M10-03 | S8 |
| M11 Reflect (NEW) | S25–S26 | FR-M11-01 – FR-M11-08 | M11-01, M11-02, M11-03, M11-04, M11-05, M11-07 | S9 |
| M12 Meditate · Rituals · Prayer (NEW) | S27–S29 | FR-M12-01 – FR-M12-08 | M12-01, M12-02, M12-03, M12-04, M12-05, M12-06, M12-07, M12-08 | S9 |
| M13 Feedback, Recovery & Personalisation | S30 | FR-M13-01 – FR-M13-04 | M13-01, M13-02, M13-03 | S10 |
| M14 Safety & Support | S31–S32 | FR-M14-01 – FR-M14-03 | M14-01, M14-02, M14-03 | S5 |
| M15 Progress, Reports & Sharing | S33–S34 | FR-M15-01 – FR-M15-03 | M15-01, M15-02, M15-03, M15-04 | S10 |
| M16 Settings, Privacy, Consent, Notifications & Plans | S35, S36, S40, S41 | FR-M16-01 – FR-M16-04 | M16-01, M16-02, M16-03, M16-04 | S1, S11 |
| M17 Admin Console & Rules Configuration | S37 | FR-M17-01 – FR-M17-04 | M17-01, M17-02, M17-03, M17-04, M17-05, M17-06 | S11 |
| M18 Institution (CAAM) | S38–S39 | FR-M18-01 – FR-M18-02 | M18-01, M18-02, M18-03 | S12 |
| M19 Platform, Integrations, Security & Data | Backend, all screens | FR-M19-01 – FR-M19-05 | M19-01, M19-02, M19-03, M19-04, M19-05, M19-06, M19-07 | S0, S12, S11 |

# **13. QA strategy**

|  |  |  |
| :-: | :-: | :-: |
| **Test type** | **What** | **Source** |
| Rules fixtures | Every row of workbook Tabs 0, 0b, 6d, 9 and 10 becomes an automated engine test (input → expected band, pathway, gate, CTA). | Rules Engine v3.2 |
| Gate tests (NEW) | RF-1 to RF-5 and MD-1 to MD-6, including the rumination guard and contraindication guard. | Tab 6c, patterns 40–41 |
| Safety | Classifier test set across Need, Dump, Express, Reflect; Help/SOS visibility on all screens. | M14, Clinical Safety Director |
| Accessibility | Screen reader, switch, 200% text, contrast, reduced motion on every screen. | NFR-01 |
| Privacy | Reflect, practices and free text never reach institution views, analytics events or shared reports without consent. | NFR-05, RF-4, MD-3 |
| Faith neutrality | Changing profile religion changes nothing in S27 lists or recommendations. | MD-3, NFR-15 |
| Entitlement (NEW v3.1) | Every pathway has a free tool for each light and context; no Advanced tiles/prompts in Amber/Red; Free and Plus get identical gate results; lapse keeps data. | Tab 6d ENT.1–ENT.6 |
| Payments (NEW v3.1) | Purchase, restore, renew, cancel, refund, lapse in app-store and web sandboxes. | US-M19-07 |
| Permissions | Role × action matrix for ADM, INS, PRO, TPI. | M17, M18 |
| Usability | Moderated sessions with neurodivergent users, including faith and non-faith participants for M12. | Ops/UX |

## **13.1 Key test cases for Reflect and Meditate**

|  |  |  |
| :-: | :-: | :-: |
| **Case** | **Given** | **Expect** |
| TC-RF-01 | Green, relief, no demand | Reflect: What helped offered as primary |
| TC-RF-02 | Yellow, intensity High (7) | Reflect not primary; Regulate or Dump first |
| TC-RF-03 | Amber, need 'make sense of today' | Card shows 'Save for later' |
| TC-RF-04 | Same topic reflected 3× in 7 days, no improvement | Reflect blocked → Dump or Regulate (pattern 40) |
| TC-RF-05 | Risk phrase typed in a Reflect answer | Reflect pauses; S31 opens |
| TC-MD-01 | Green, interview at 2pm, unease 5 | Meditate 5-min settle → Execute |
| TC-MD-02 | Amber with distress 7 | Regulate primary; Meditate ≤3 min eyes-open as alternative |
| TC-MD-03 | Shutdown flag set | No eyes-closed or body scan primary; Regulate Ground/Move |
| TC-MD-04 | User flag 'meditation makes me worse' | Meditate never primary; saved rituals/prayer still available if user opens them |
| TC-MD-05 | Open-plan office, prayer due | Adapt (quiet room) → user's own practice; spoken prayer not offered in public |
| TC-MD-06 | Quiet hours / 'In worship' on | No Nuccess notifications sent |
| TC-ENT-01 | Free user, Amber, overwhelm 7 | Free Breathe/Ground primary; no Advanced tile, lock or price anywhere |
| TC-ENT-02 | Free user, Green, restless at home | Free Move primary; one alternative 'Create — Advanced' |
| TC-ENT-03 | Free user, saved prayer due | User's own prayer opens; no upgrade prompt |
| TC-ENT-04 | Plus lapsed | Reflections, dumps, Adjustment Passport and reports readable and exportable |

# **14. Analytics events and success metrics**

|  |  |  |
| :-: | :-: | :-: |
| **Event** | **Properties (no free text)** | **Used for** |
| checkin_completed | cell_id, source, rules_version | Check-in completion, state trends |
| recommendation_shown | band, light, primary, alternatives, patterns, gates | Engine quality |
| recommendation_action | action (start / try another / not now / support) | Acceptance rate |
| pathway_session_completed | pathway, tool, length, stopped_early | Pathway use |
| feedback_submitted | helped, effort, recheck_delta | Helpfulness, recovery rate |
| reflect_gate_applied (NEW) | gate (RF-1/RF-2), fallback | Rumination protection |
| reflect_saved (NEW) | variant, saved (bool) | My Patterns adoption |
| practice_started / completed (NEW) | type, source (user/library), length, eyes_open, context_public | Practice use |
| meditate_gate_applied (NEW) | gate (MD-1/MD-2), fallback | Contraindication protection |
| safety_override | source module | Safety monitoring |
| advanced_tile_shown / dismissed (NEW) | pathway, tool_id, light | Conversion and fairness (must be zero in Amber/Red) |
| plan_viewed / purchased / cancelled / lapsed (NEW) | plan, source, entry point (pathway or settings) | Revenue and churn |

## **14.1 Success metrics**

  - Recommendation acceptance rate (Start) and 'helped' rate per pathway, including Reflect and Meditate.
  - Share of support sessions followed by an improved re-check (Blue Recovery rate).
  - Rumination guard: share of users whose next re-check is the same or better after a blocked Reflect.
  - Meditate safety: share of MD-2 users who report Regulate helped; zero increase in 'felt worse' after practices.
  - Time from check-in to first action.
  - Retention without streaks (30-day active users).
  - Free-to-Plus conversion by pathway, Plus retention, institution seats activated — with zero Advanced prompts shown in Amber/Red (fairness check).

# **15. Governance, RACI and open items**

|  |  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **Area** | **Founder/PO** | **Designer** | **Tech Lead** | **Clinical Safety** | **Ops/UX** | **Admin** |
| Core engine (Energy × Mood, NUCRIPCE, pathways, gates) | A | C | R | C | C | I |
| PRD / FRD | A | C | C | C | C | I |
| User flow and journey | A | R | C | C | R | I |
| UX/UI | A | R | C | C | C | I |
| Backend, APIs, data | A | C | R | C | I | I |
| Safety rules, RF/MD gates | A | C | R | R | C | I |
| Practice library and faith copy | A | C | I | R | R | I |
| Plans, pricing and tool tiers | A | C | R | C (safety floor) | R | R |
| QA and release | A | C | R | C | C | I |
| Analytics and admin reporting | A | C | R | C | R | R |

R = Responsible, A = Accountable, C = Consulted, I = Informed.

## **15.1 Edge cases**

|  |  |
| :-: | :-: |
| **Case** | **Required behaviour** |
| User cannot name a need | State-first entry, examples, voice, 'I just want support', Dump, Regulate or Help. |
| User rejects a recommendation | No penalty; Not now, Try another, change state, or open any module manually. |
| User opens Reflect directly while in Red | Gentle guard: offer Dump or Regulate; Help visible; no lecture. |
| User opens Meditate directly with the 'makes me worse' flag | Allowed (user choice) with eyes-open defaults; never suggested by the engine. |
| Practice due during Amber | Gentle reminder or none (capacity-tuned); never a 'missed' message. |
| AI unavailable | Deterministic engine continues; AI features show a simple fallback. |
| Best-fit tool is Advanced, user is Free | Use the best free tool in the same pathway as primary; Advanced only as a labelled alternative in Green/Yellow/Blue. |
| Subscription lapses or payment fails | Grace period, then Advanced tools lock; all user content stays readable and exportable; no guilt copy. |
| Under-18 user via institution | Plus comes only through the institution licence; no in-app purchase available. |
| Deadline T0 with Red state | Support first; demand deferred; repair help offered afterwards. |

## **15.2 Open items before release**

  - Clinical Safety Director sign-off of RF-5 safety screening, MD-2 contraindication list and Reflect/Meditate copy.
  - Consultation with faith and neurodivergent user groups on S27–S29 and the neutral library.
  - PO approval of the neutral practice library v1 scripts and audio.
  - Engineering confirmation of estimates and sprint capacity.
  - PO to set Plus prices, trial length and concession eligibility in the financial plan; legal review of subscription terms; licences for Advanced audio/movement content.
  - Clinical Safety Director to confi
