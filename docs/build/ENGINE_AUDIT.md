# Engine conformance audit (workbook v3.3)

What was checked: every tab of `docs/specs/rules-engine-v3.3/`, every Tab 12 gap, and the engine sections of `SYSTEM_DESIGN.md` §5. Each was traced to code and tests in `packages/engine` (engine), `apps/api/src/modules/recommendation` (signals) and the admin and billing modules.

Status key:
- **OK**: built and tested.
- **Fixed**: was missing or wrong, fixed in this pass.
- **Partial**: built, with a stated gap.
- **Open**: not built; reason given.

## Headline numbers

| Check | Result |
|---|---|
| Tab 0 + 0b scenarios, primary pattern | 183/189 match the first listed pattern and all 189 pass the scenario test. E2M3.2 lists patterns 12 and 13 and gets 13. REC.3 is the RC-4 re-check: no Blue, and a route different from the one that didn't help. The other 4 are the documented Tab 0 tolerances (E1M2.3 6→8, E1M3.4 4→15, E2M2.2 4→3, E4M2.4 5→7). |
| Scenario lights (93 scenarios state one) | 93/93 |
| Card titles vs workbook wording | 167/189 (was 135); the rest are scenario-specific copy (e.g. "Want to stretch for a minute?", "Read one section, then see how you feel") rather than rule outputs |
| Engine tests | 281 (scenarios, rules, properties, new invariants at a fixed seed of 2,500 runs each) |

## Tabs

| Tab | What it defines | Where | Status |
|---|---|---|---|
| 1 | 16 cells, baseline band, name/icon/meaning | `stages/state.ts`, snapshot `cells` | OK |
| 2 | Emotion families, intensity bands, sensation-led rows | `stages/experience.ts` | OK |
| 3a/3b | Sensitivity flags, context classes, tool exclusions | `stages/context.ts`, `stages/card.ts` `usable()` | OK |
| 4 | Timelines T0–T6, TX, TR, step caps | `stages/demand.ts`, result `timeline.stepCap` | OK |
| 5 | NUCRIPCE drivers; urgency from the timeline only | `driversFor()` | OK |
| 6 | Demand characteristics → drivers | snapshot `demandTraits` | OK |
| 6b | Need → route / pattern | `resolveNeeds()`, `ROUTE_RULES` | OK |
| 6c | RF-1…RF-5, MD-1…MD-6 | `gates/index.ts` | Fixed (RF-2), see below |
| 6d | ENT-1…ENT-9 | `stages/card.ts`, billing, admin snapshots | Fixed (ENT-3, 8, 9) |
| 7 | Patterns 1–41 | `patterns/*.ts` | Fixed (3 in Red, 34) |
| 8 | Decision sequence (stages 0–12) | `evaluate.ts`, trace stages | OK |
| 9 | Worked example | covered by scenarios | OK |
| 10 | EX-1, CX-1, CAP-1, UP-0, DEM-0, E4M1, NS-1, SF-1, SF-2, RC-1…RC-5 | `stages/band.ts`, `recheck.ts`, `safety/`, `apps/api/.../safety/sustained.ts` | Fixed (RC-2, RC-4 support) |
| 11 | Journey layers and bounded AI | see "Tab 11" | Partial |
| 12 | Gaps | see "Tab 12" | OK, with the noted exceptions |

## Rules

| Rule | Status | Code | Tests |
|---|---|---|---|
| EX-1, CX-1, CAP-1 | OK | `stages/band.ts` | `rules.test.ts`; invariant "at most two steps down" |
| UP-0 | OK | the band is never raised within a check-in | invariant |
| DEM-0 | OK | a demand never changes the band | invariant (with vs without the demand) |
| E4M1, NS-1 | OK | `band.ts`, `stages/state.ts` | `rules.test.ts` |
| SF-1 | OK | `safety/screen.ts`; option and phrase sources | properties and invariants: support primary, Red, no Not now, no Advanced |
| SF-2 | OK | `apps/api/src/modules/safety/sustained.ts` | `sustained.spec.ts` |
| RC-1 | OK | `assessRecheck()` | invariant: Blue only after a completed session |
| **RC-2** | **Fixed** | The recovery window (a Blue re-check, or `recoveryActive`) keeps drivers to Routine. Open-band task patterns 2 and 14 become the gentle pattern 31. | `rules.test.ts` "RC-2"; invariant for Blue |
| RC-3 | OK | one step up per re-check | invariant |
| **RC-4** | **Fixed** | A different route was already chosen. A worse re-check now also shows the Support pathway (G-ST3), not only in Red. | `rules.test.ts` "G-ST3"; invariant |
| RC-5 | OK | no Blue after a safety override | invariant |
| RF-1 | OK | Red/Amber/High+ block Reflect | `rules.test.ts` |
| **RF-2** | **Fixed** | Adds "the re-check after Reflect is worse". The rumination family and the repeated-topic rule were already in. | `rules.test.ts`; invariant |
| RF-3, RF-4 | OK (product) | Reflect screens: 3 prompts, stop anytime, no streaks; reflections are private and excluded from institution views | PWA Reflect, institutions aggregates |
| RF-5 | OK | free text goes through the safety screen | API e2e (reflect-connect) |
| MD-1 | OK | `demoteMeditate()` | `rules.test.ts` |
| MD-2 | OK, signal fixed | The contraindication guard existed; the `bodyScanOptIn` signal is now set (B-39) | `rules.test.ts` |
| MD-3 | OK | content only from My Practices or the neutral library | snapshot / practices |
| MD-4 | OK | public settings: no eyes-closed or spoken practice; length cap | `usable()` |
| MD-5 | OK (product) | Practice reminders respect quiet hours and In worship; no streaks | `notifications/policy.spec.ts` |
| MD-6 | OK | Support is never hidden while the Support pathway or the safety override is active | invariants |
| ENT-1 | OK | the primary is always usable on the plan | properties |
| ENT-2 | OK | safety, export and delete are never gated | API entitlements |
| **ENT-3** | **Fixed** | The rule existed, but `inSession` and `dismissedAdvanced` were never set. Both are now set, and the card has a dismiss button that is remembered (B-39). | invariant over all signals |
| ENT-4 | OK | the user's own practices are free | practices schema comment, entitlements |
| ENT-5 | OK, now tested | free and Plus get the same band, light, pattern, support and blocking gates | new invariant |
| ENT-6 | OK | lapse keeps data (`subscription_ended` → `free`, content readable) | `platform.e2e.ts` |
| ENT-7 | OK | institution licences give Plus; the institution sees aggregates only | `personas.e2e.ts` |
| **ENT-8** | **Fixed** | Checkout requires a confirmed adult; an institution-covered under-18 account can't buy (B-41) | `platform.e2e.ts` |
| **ENT-9** | **Fixed** | Tier changes in Regulate, Connect, communication cards or the safety floor mark the snapshot `touchesSafety`, which needs the safety reviewer to publish | `admin/snapshots.spec.ts` |

## Patterns

All 41 are implemented (`patterns/index.ts`, `specific.ts`, `practice.ts`). Two were corrected:

- **Pattern 3 in Red.**
  - Bug: any Routine driver let "Start small" through in Red. Random testing found Red giving an Execute primary for an imposed, multi-step task, and when the user had asked to rest.
  - Fix: now only a purely familiar task (every driver Routine, no rest need) keeps the Tab 0 E1M2.6 wording (B-40).
- **Pattern 34.**
  - Bug: it was offered in any light.
  - Fix: now Green, Yellow or Blue only, as Tab 7 says.

Titles:
- Titles now follow the tool actually shown after stage 9's discreet swap (no "move" title on a breathing card).
- Pattern 12 fills its [environment/format/pace] slot from the Adapt tool.
- "Reduce the load" and "take care of you" follow the Tab 0 split.

## Tab 11 (journey layers and bounded AI)

| Layer | Bounded AI role | Status |
|---|---|---|
| 0 | Classifier flags risk; fixed copy | OK (rules-based screen; the model never replies) |
| 2b | Suggest a cell; the user confirms | OK (`suggestCell`) |
| 3 | Optional: free text → family, ask if confidence < 0.7 | **Open.** The optional free-text box goes through the safety screen and `parseNeed` ("heard" chips), but the engine doesn't map it to an emotion family with a confidence score. The user picks families from chips. |
| 5 | Optional: suggest context from the calendar | Open (no calendar integration; data minimisation) |
| 6 | Split free text into demands | **Open.** Each demand is entered on its own. |
| 7, 9 | Classify demand type / propose drivers with confidence; rules decide | Partial: `suggestDrivers` proposes characteristics; the user confirms and the rules decide. There's no numeric confidence (the fallback is rule-based, X-04). |
| 10 | May rephrase the rationale within the template | Not used: the rationale is the template itself, which the workbook allows ("may"). |
| 11 | Task breakdown within the step cap; drafts approved before sending | OK (`breakDownTask`, `draft`, `rewrite`) |
| 12 | Personalisation re-orders alternatives only | **Fixed:** opt-in with consent and a minimum of 5 outcomes (B-38) |
| 13 | Pattern detection only | OK (SF-2) |
| 14 | Aggregates only | OK (cohort floor) |

## Tab 12 gaps

All gaps marked "Added" are in the snapshot and covered by scenarios or rule tests, except these:

- **G-ST3**: Fixed (worse → Support visible).
- **G-ST4** (personal timing): "Proposed" in the workbook, so not built.
- **G-SF3** (adults only, 16–17 via institutions): Fixed for purchases (ENT-8). Settings has an age and safeguarding page. Sign-up doesn't ask for age yet (the Plans screen asks before checkout).
- **G-JR4** (AI confidence thresholds): Partial, see Tab 11.
- **Needs clinical sign-off** (G-EM13, G-SF1, G-SF2, G-IN1 prompt copy, G-IN2, G-IN4; RC-5 pathway): implemented as written, flagged in the snapshot review flow (`touchesSafety`). Clinical sign-off is a human step (D-36).

## Still open

1. Free-text emotion mapping with a 0.7 confidence check (Tab 11 layer 3), and demand splitting (layer 6). Both need the real model and the quality test in SYSTEM_DESIGN §4.3.8 (X-04).
2. A "this keeps coming up, want to look at it?" confirmation screen for `recurringStruggleConfirmed` (pattern 34's second trigger).
3. RF-2's "no improvement" condition on the repeated-topic counter. The counter is 3+ in 7 days; outcomes aren't yet linked to topics.
