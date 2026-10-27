# NUCCESS: conflicts and open decisions

Places where the source documents, the Figma designs and the live website disagree, or leave a decision open. Each item says what each source says, why it matters for the build, a recommendation, and who decides.

**Sources compared**

| Short name | Document |
| --- | --- |
| Workbook | Recommendation Rules Engine v3.3 (`docs/specs/rules-engine-v3.3/`) |
| PRD | PRD/FRD v3.1 (`docs/specs/nuccess-prd-frd-v3.1.md`) |
| Activity | Activity Tables v2.1 (`docs/specs/nuccess-activity-tables-v2.1.md`) |
| Privacy | Privacy Notice draft v0.1 (`docs/specs/nuccess-privacy-notice-v0.1.md`) |
| Website | Website Copy v2 (`docs/specs/website-copy-v2.md`) and https://figcit-website.vercel.app/ |
| Figma | UI Design page, exported to the PWA repo `design/` (frame names like "Figma S13") |

"PRD S13" means the spec's screen numbering; "Figma S13" means the Figma frame name. They differ (see the PWA repo `design/FLOWS.md`).

**Priority**
- **P1: blocks the first sprints** (accounts, onboarding, check-in, engine). Needs an answer before we build that part.
- **P2: blocks a later module.** Can wait until that sprint.
- **P3: wording or polish.** We'll follow the recommendation unless told otherwise.

**Status:** all items are open. Record decisions in the "Decision" line of each item.

---

## Summary

| ID | Topic | Priority | Decider |
| --- | --- | --- | --- |
| [D-01](#d-01-app-name-figcit-or-nuccess) | App name: Figcit or NUCCESS | P1 | Founder |
| [D-02](#d-02-age-rule) | Age rule: 16+ or 18+ | P1 | Founder, legal |
| [D-03](#d-03-health-data-consent-at-sign-up) | Health-data consent at sign-up | P1 | Founder, legal |
| [D-04](#d-04-profile-fields-dob-neurotype-religion) | Profile fields: DOB, neurotype, religion | P1 | Founder, legal |
| [D-05](#d-05-consent-toggles-default-to-on) | Consent toggles default to on | P1 | Legal |
| [D-06](#d-06-band-names-on-screen) | Band names on screen | P1 | Founder |
| [D-07](#d-07-hopeless-chip-and-immediate-risk) | "Hopeless" chip and immediate risk | P1 | Clinical Safety |
| [D-08](#d-08-need-list-12-in-figma-21-in-the-workbook) | Need list: 12 in Figma, 21 in the workbook | P1 | Founder |
| [D-09](#d-09-emotion-chips-vs-experience-families) | Emotion chips vs experience families | P1 | Founder, Clinical Safety |
| [D-10](#d-10-navigation-no-route-to-most-screens) | Navigation: no route to most screens | P1 | Designer |
| [D-11](#d-11-sign-in-two-versions-of-s04) | Sign-in: two versions of S04 | P1 | Founder, designer |
| [D-12](#d-12-voice-processed-on-your-device) | Voice "processed on your device" | P1 | Tech lead |
| [D-13](#d-13-plans-tiers-and-prices) | Plans, tiers and prices | P2 | Founder |
| [D-14](#d-14-payment-methods) | Payment methods | P2 | Founder, tech lead |
| [D-15](#d-15-free-vs-advanced-labels-in-figma) | Free vs Advanced labels in Figma | P2 | Founder |
| [D-16](#d-16-anonymity-floor-5-or-20) | Anonymity floor: 5 or 20 | P2 | Founder, legal |
| [D-17](#d-17-what-institutions-see-about-individuals) | What institutions see about individuals | P2 | Founder, legal |
| [D-18](#d-18-automatic-sharing-when-sos-is-used) | Automatic sharing when SOS is used | P2 | Clinical Safety, legal |
| [D-19](#d-19-escalation-and-monitoring) | Escalation and "we do not monitor" | P2 | Clinical Safety, legal |
| [D-20](#d-20-connect-social-features-and-in-app-messaging) | Connect: social features and in-app messaging | P2 | Founder |
| [D-21](#d-21-help-sos-wording) | Help/SOS wording | P2 | Clinical Safety |
| [D-22](#d-22-research-data-export) | Research data export | P2 | Founder, legal |
| [D-23](#d-23-ai-training-on-user-data) | AI training on user data | P2 | Founder, legal |
| [D-24](#d-24-two-red-cards) | Two different Red cards | P2 | Designer |
| [D-25](#d-25-heading-typeface) | Heading typeface | P3 | Designer |
| [D-26](#d-26-feedback-scale) | Feedback scale | P3 | Founder |
| [D-27](#d-27-quiet-hours-default) | Quiet hours default | P3 | Founder |
| [D-28](#d-28-body-double-named-arraka) | Body double named "Arraka" | P3 | Founder |
| [D-29](#d-29-check-in-step-counter) | Check-in step counter | P3 | Designer |
| [D-30](#d-30-rule-ids-on-admin-screens) | Rule IDs on admin screens | P3 | Tech lead |
| [D-31](#d-31-wins-stars-and-counts) | Wins, stars and counts | P3 | Founder |
| [D-32](#d-32-pathway-names-on-the-website) | Pathway names on the website | P3 | Founder |
| [D-33](#d-33-low-stimulation-mode) | "Low-stimulation mode" | P3 | Designer |
| [D-34](#d-34-hub-booking-in-the-app) | Hub booking in the app | P3 | Founder |
| [D-35](#d-35-missing-and-mismatched-document-versions) | Missing and mismatched document versions | P2 | Founder |
| [D-36](#d-36-workbook-open-items) | Workbook items still marked "confirm" | P1 | Founder, Clinical Safety |
| [D-37](#d-37-build-plan-vs-other-plans-in-drive) | Build plan vs other plans in Drive | P1 | Founder |
| [D-38](#d-38-ai-model-per-task) | Which open model per task | P2 | Tech lead, after speed tests |
| [D-39](#d-39-support-without-a-check-in) | Support without a check-in | P1 | Founder, Clinical Safety |

---

## Identity and accounts

### D-01 App name: Figcit or NUCCESS
- **PRD, Workbook, Activity, Privacy:** the app is "NUCCESS". Copy examples use "Nuccess suggests…".
- **Figma:** the app is "Figcit" throughout ("How Figcit works", "Figcit suggests", "Invite a friend to Figcit").
- **Website:** "the Figcit app".
- **Why it matters:** app name, PWA manifest, page titles, all engine copy, privacy notice and store listings.
- **Recommendation:** decide one user-facing name. Keep "nuccess" as the internal code name either way.
- **Decision:**

### D-02 Age rule
- **Privacy §2, §10:** NUCCESS is for 18+; 16–17 only through a participating institution (bracketed, unconfirmed).
- **Activity P1 step 10, P2 step 9; PRD ENT-8, 15.1:** adults 18+ by default; 16–17 only through an approved institution licence; no purchases under 18.
- **Website (Services, FAQ, forms):** "Young people aged 16 and over"; 16–17 join through their college; the early-access form asks to "confirm 16 or over".
- **Figma:** no age question anywhere in sign-up.
- **Why it matters:** sign-up must check age; institution invite flow must allow 16–17.
- **Recommendation:** 18+ for self sign-up, 16–17 only via an institution code, and an age confirmation step at sign-up (see D-03). Align the website wording.
- **Decision:**

### D-03 Health-data consent at sign-up
- **Privacy §3:** check-ins are health data, used only with explicit consent (UK GDPR Art. 9(2)(a)) "given when you set up NUCCESS", withdrawable in Settings.
- **PRD FR-M16-01:** per-purpose consent.
- **Figma:** no consent step in onboarding (Figma S01–S04). Consent appears only as toggles inside Settings (Figma S29).
- **Why it matters:** we can't store a check-in without it. Browse mode (no account) still processes the data.
- **Recommendation:** add one plain-language consent screen after Quick Setup, before the first check-in, for both account and Browse users. Separate optional toggles for personalisation, analytics and research.
- **Decision:**

### D-04 Profile fields: DOB, neurotype, religion
- **Activity P1 step 9:** "Register" collects name, nickname, date of birth, location, neurotype, status (all optional).
- **PRD 13 (QA):** "Changing profile religion changes nothing in S27 lists", which implies a religion field.
- **Privacy §2:** lists name or nickname, email, password, an 18+ confirmation. No DOB, location, neurotype or religion.
- **Website build notes:** "Never ask for a diagnosis, health details or date of birth" (for website forms).
- **Figma:** no registration screen, only "Add a fuller profile later (optional)".
- **Why it matters:** neurotype and religion are special-category data. Collecting them needs a lawful basis and must be in the notice.
- **Recommendation:** for the MVP, no neurotype, religion or DOB fields. Age is a confirmation, not a date. Add fields later only with the notice updated.
- **Decision:**

### D-05 Consent toggles default to on
- **Figma S29:** "Personalise suggestions from my feedback" and "Help improve Figcit (anonymous)" are shown switched on.
- **Privacy §3:** analytics only with consent. UK GDPR consent must be opt-in, not pre-ticked.
- **Recommendation:** all optional consents off until the user turns them on (at the D-03 screen or in Settings).
- **Decision:**

### D-11 Sign-in: two versions of S04
- **Figma:** S04 exists twice: an email-first version (magic link, Apple, Google, Browse) and a fuller version (Sign in / Create account tabs, email, passkey, Apple, Google, institution SSO). S04-2 adds a password.
- **PRD FR-M01-02:** email/password, passkey, social, institution SSO; MFA for staff.
- **Privacy §2:** "password (encrypted)".
- **Why it matters:** decides the auth build for S0/S1.
- **Recommendation:** MVP = email magic link + optional password, Google, and Browse. Apple, passkey and institution SSO later. Staff accounts get MFA from the start.
- **Decision:**

---

## Engine and check-in

### D-06 Band names on screen
- **PRD 1.5, 4.1, FR-M02-02, Workbook Tab 8:** band names are never shown. Users see colour, label wording ("Let's reduce the load first") and the state name.
- **Workbook Tab 10:** "Colour is never the only signal: every light also shows its label and an icon".
- **Website build notes:** traffic lights "always carry a text label: Available, Conditional, Constrained, Very constrained, Recovery".
- **Figma S06, S13, S14:** show "Conditional" and "Very Constrained" under the state name. S153 and S154 show the card wording instead.
- **Why it matters:** accessibility needs a text label next to the colour; the PRD forbids the band word. The text label could be the card wording.
- **Recommendation:** show the light with the plain wording (Green "Good to go", Yellow "Go gently", Amber "Reduce the load first", Red "Take care first", Blue "Steadier") instead of band names. Wording to be approved.
- **Decision:**

### D-07 "Hopeless" chip and immediate risk
- **Workbook Tab 2:** "Immediate risk language: hopelessness, not wanting to be here, thoughts of self-harm (selected option or free text)" → pattern 28, safety override, bypasses bands (SF-1).
- **Figma S07:** "Hopeless" is an ordinary emotion chip next to "Grief", with no indication that choosing it opens support.
- **Why it matters:** choosing it must route to Help/SOS. That must be designed and clinically approved, not discovered by the user.
- **Recommendation:** Clinical Safety decides whether "Hopeless" is a risk trigger or an ordinary low-mood emotion. If it's a trigger, design the moment it opens support (a gentle interstitial, not a jump).
- **Decision:**

### D-08 Need list: 12 in Figma, 21 in the workbook
- **Workbook Tab 6b:** 21 needs, each mapped to a route, including Break it down, Decide what matters now, Stop or switch, Rest without guilt, Ask for help or an adjustment, Prepare for an event, Recover after an event, Learn what works for me, Start or end my day well, Feel connected to something bigger.
- **Figma S11:** 12 options. It includes "I'm grateful, I want to note it", which has no row in Tab 6b (gratitude exists only as an experience family in Tab 2).
- **Why it matters:** the engine keys on the need code. Every option on screen needs a row, and vice versa.
- **Recommendation:** show the 12 as the top level with "More…" for the rest, and add a gratitude row to Tab 6b (route: Reflect gratitude note, Meditate gratitude practice).
- **Decision:**

### D-09 Emotion chips vs experience families
- **Workbook Tab 2:** 33 experience families drive the pathway choice.
- **Figma S07:** 18 harder and 9 lighter chips. Several families have no chip (rejection/hurt, boredom, social hangover, task paralysis, confusion, panicked); some live in sensations instead (shutdown, hyperfocus, time blindness, decision paralysis in the Cognitive tab; sensory overload in Sensory). "Tired" and "Foggy" have no family.
- **Why it matters:** each chip must resolve to a family (PRD FR-M03-01), and some sensations set engine flags (shutdown, overload).
- **Recommendation:** we draft a chip → family → flag mapping table for approval, and add the missing chips or confirm they're intentionally covered by sensations.
- **Decision:**

### D-39 Support without a check-in
- **Figma S05:** Home has "I need help with…", which goes straight to the Need screen (S11) without a check-in. S11 offers "I just want support", which skips the task question.
- **PRD 3 (support-only flow):** "any entry → Need ('I just want support') → Engine → pathway → Feedback."
- **Workbook Tab 8, steps 1–2:** the user may "state what they need help with, OR simply check in", but step 2 (Energy × Mood → cell → baseline band) is what every later stage builds on.
- **Gap:** none of the documents say what the engine does with no state. Through "I need help with…" there's no check-in, so no light; with "I just want support" there's no specific need either.
- **Why it matters:** the light decides what's safe to offer (Amber forces support first, Red defers tasks and shows "Get support now", Advanced tools are hidden in both). Guessing a light could offer too much to someone who is struggling.
- **Recommendation:**
  1. If there's a check-in from the last few hours (configurable, e.g. 4 hours), use its state; Home already shows it with "Re-check".
  2. Otherwise, before the card, show one skippable Energy × Mood screen (two taps).
  3. If skipped, treat it as "Not sure": baseline Yellow (rule NS-1), with EX-1 still applying if a strong feeling is logged, and nothing raising it.
  4. If there's also no specific need ("I just want support"), the card offers a short choice of free support (Regulate, Dump, Connect) with Help visible, instead of one recommendation.
  5. Safety is unchanged: typed text is still checked and Help is always one tap away.
- **Decision:**

### D-36 Workbook open items
- **Workbook Tab 10 and README:** E4M1 baseline rule ("v3 - confirm"), Not-sure default Conditional (NS-1, "confirm"), pattern 6 vs 8 precedence unresolved, traffic-light colours "proposed", every safety row "needs clinical sign-off", all thresholds "MVP starting points".
- **Why it matters:** the engine will be built and tested against these. Unconfirmed rows can still be built as configuration.
- **Recommendation:** build them as written, as versioned configuration, and flag them in the admin rule review until signed off.
- **Decision:**

### D-24 Two Red cards
- **Figma S13:** Red ("Gentle Drift · Very Constrained"): "Try a short reset", "Dump instead", "Talk to someone". No "Get support now".
- **Figma S154:** Red ("Hibernate"): "Breathe for 1 minute", "Get support now · 999 · 111 · Samaritans".
- **PRD 8.2, Workbook Tab 10:** Red always shows "Get support now".
- **Recommendation:** use S154 as the Red pattern; S13 becomes an outdated variant.
- **Decision:**

### D-29 Check-in step counter
- **Figma:** S06 "1/3", S07 "2/3", S08 "3/3", then S90 Context also "3/3"; Sensations and Context have no counter.
- **Recommendation:** drop the counter (steps are optional and vary) or count only the required steps.
- **Decision:**

---

## Safety and privacy

### D-16 Anonymity floor: 5 or 20
- **Privacy at-a-glance, §5:** institutions see trends "for groups of five or more".
- **Figma S32, S146:** "Cohorts under 20 students are hidden… Floor of 20 is fixed and can't be lowered."
- **Figma S144:** HR drill-down shows a team of 18 staff, which is under Figma's own floor.
- **PRD FR-M18-01:** "minimum cohort size" (no number).
- **Recommendation:** one configurable floor, default 20 (safer), with the notice updated to match. Fix S144.
- **Decision:**

### D-17 What institutions see about individuals
- **Privacy, Website FAQ:** "Who can see my check-ins? Only you." Organisations see only anonymised group trends; never individual check-ins.
- **PRD S39, FR-M18-02, Figma S50:** an opt-in, time-limited Institution User Summary of one named student: check-in count, most common state, direction, flags ("Asked for help with deadlines"), plus "Request outreach".
- **Why it matters:** the summary is individual data shared by consent; the notice and website say this never happens.
- **Recommendation:** keep the opt-in summary (it's in the PRD) but add it to the notice and the website FAQ ("unless you choose to share a summary").
- **Decision:**

### D-18 Automatic sharing when SOS is used
- **Figma S27:** consent toggles "Notify a contact if I use SOS" and "Share summary with GP if I use SOS". Figma S119: a contact "may be contacted when… I use Help / SOS / Escalation is triggered".
- **Privacy §5:** a trusted contact hears from us "only if you choose to send them a message"; no mention of GP sharing.
- **Why it matters:** automatic messages at the moment of a crisis are a clinical-safety and data-protection decision, and sending to a GP needs an integration we don't have.
- **Recommendation:** MVP: no automatic sharing. SOS offers a one-tap pre-written message to a chosen contact, sent by the user. Revisit with Clinical Safety.
- **Decision:**

### D-19 Escalation and monitoring
- **Privacy §5:** "We do not monitor check-ins in real time."
- **Workbook SF-2:** Very Constrained for 7+ days, or 14+ with no improvement, escalates the support route.
- **Figma S119, S161:** "Escalation is triggered"; "Escalations reviewed weekly by Clinical Safety".
- **Why it matters:** SF-2 is automated monitoring of the user's states. Weekly human review of escalations is monitoring by staff.
- **Recommendation:** SF-2 only changes what the user sees (a gentle "it's been a hard week" card with routes), with no staff notification. Say so in the notice.
- **Decision:**

### D-21 Help SOS wording
- **PRD FR-M14-01, NFR-06; Workbook pattern 28:** fixed, clinically reviewed copy; "no unsafe reassurance".
- **Figma S26:** "You are not alone. We're here to help you find the right support. You can do this."
- **Website and Privacy:** list 999, NHS 111 option 2, Samaritans 116 123, Shout 85258, which matches Figma.
- **Recommendation:** keep the routes; Clinical Safety approves the wording before launch ("You can do this" is the line most likely to change).
- **Decision:**

### D-12 Voice "processed on your device"
- **Figma S88:** "Voice turns into text on your device. Recordings are deleted once transcribed unless you choose to keep them." S102: "Audio deleted after transcription".
- **Figma S117, S45:** Express keeps voice notes as audio; Meditate plays the user's own uploaded audio.
- **Privacy §2:** no mention of audio recordings.
- **Why it matters:** in a browser, the built-in speech recognition (Chrome) sends audio to Google's servers, so "on your device" isn't true for a PWA without an on-device model.
- **Recommendation:** transcribe on our own server with the open Whisper model (backend design 4.3.5), so audio never goes to a third party. Change the copy to "Processed privately on Figcit's own servers and deleted after transcription" and add audio to the notice. In-browser Whisper could make "on your device" true later.
- **Decision:**

### D-22 Research data export
- **PRD NFR-14, Figma S149:** a consented, de-identified research dataset ("2,914 users opted in, consent version 2.1").
- **Privacy §3:** only "improve NUCCESS using anonymised or aggregated information" under legitimate interests; no research consent.
- **Recommendation:** add a separate research consent (off by default, D-05) and a research section to the notice.
- **Decision:**

### D-23 AI training on user data
- **Privacy §4:** "[we do not allow our AI providers to use your data to train their models — confirm in supplier contract]".
- **Figma S88:** "Never used to train models without consent", which implies training with consent is possible.
- **Recommendation:** "never used to train AI models", full stop. The privacy notice's AI section should also say the models are open source and run on Figcit's own servers, with no AI provider involved.
- **Decision:** No third-party AI provider: open-source models self-hosted by Figcit (founder, 26 Oct 2026). User data is never used to train models.

---

## Plans and payments

### D-13 Plans, tiers and prices
- **PRD 1.9:** Free, NUCCESS Plus, Plus concession, Institution licence; prices, trial and concession are "TBC in the financial plan", held as configuration.
- **Website (Services):** Free daily check-in · Prime £7/month · Premium £13/month · Hub add-on £8/month from Jan 2028 · organisations £6 per person per month.
- **Figma S52, S143, S159:** Prime "for students" £7/month or £75/year, Premium "for professionals" £13/month, Institution £6 per seat per month.
- **Why it matters:** two paid tiers vs one. If Prime and Premium unlock the same tools, Prime is the PRD's "concession"; if they differ, the tool catalogue needs a third tier.
- **Recommendation:** confirm whether Prime and Premium unlock the same Advanced tools and differ only by eligibility (students). If so, build one Advanced entitlement with two prices.
- **Decision:**

### D-14 Payment methods
- **PRD FR-M19-05; Privacy §2:** app-store billing and a web payment provider; Figcit never sees card details.
- **Figma S143, S159:** Apple Pay, Google Pay, PayPal and card inside the app ("Visa ending 4417").
- **Why it matters:** a PWA can't use app-store billing. If it's later wrapped with Capacitor, Apple and Google require their own billing for digital subscriptions bought inside the app.
- **Recommendation:** MVP on the web: a hosted checkout from one provider (Stripe or Paddle) with Apple Pay, Google Pay and cards; no card data held. Revisit store billing when wrapping.
- **Decision:**

### D-15 Free vs Advanced labels in Figma
Each of these is a paid (Advanced) feature in PRD 1.9 / Workbook Tab 6d but shown in Figma without the "Advanced" label:

| Figma | Feature shown | PRD tier |
| --- | --- | --- |
| S20 Focus | "Body double on: Arraka is working alongside you" | AI body double is Advanced (S113 is labelled) |
| S21, S22 Express | "Draft: thought into a first draft" as the default | "Draft from scratch" is Advanced; free is Simplify/Rewrite with a daily allowance |
| S17 Dump Review | Suggested buckets ("Suggestions are editable") | AI sorting suggestions are Advanced; free is manual sorting |
| S107 Dump History | "Search thoughts…" | Search across all dumps is Advanced |
| S43 My Patterns | Pattern cards, "Helped 5 times this month" | Free is a list of takeaways; trend cards are Advanced (S133 is labelled) |
| S23 Connect | Body double session, async community group, events | Human body-double rooms and moderated peer spaces are Advanced |
| S47 Report | Two active shares (therapist and GP) | Free is one summary with one named person |

- **Recommendation:** follow the PRD tiers (configuration, ENT-9) and add the labels in the build. Confirm if any should move.
- **Decision:**

---

## Product scope

### D-20 Connect: social features and in-app messaging
- **PRD S24, 1.9:** trusted contacts, one-tap messages sent through the device's own apps, groups the user has added; Advanced: moderated peer spaces, check-in buddy, hosted sessions.
- **Figma S23, S118:** "Find friends" search by username, "Invite a friend to Figcit", "This week's events · 3 near you", and "Send via… In-app".
- **Privacy:** no user directory, usernames, location or message storage.
- **Why it matters:** a user directory and in-app messaging are a social network: moderation, blocking, reporting, safeguarding, location data and a much larger build.
- **Recommendation:** MVP: trusted contacts with SMS/WhatsApp/email hand-off only. Park find friends, events and in-app messaging.
- **Decision:**

### D-34 Hub booking in the app
- **Website (Hub):** "Book through the app, which suggests the space that fits your traffic light"; Hub add-on £8/month from Jan 2028.
- **PRD, Figma:** no Hub screens or bookings.
- **Recommendation:** out of MVP scope; revisit for the 2028 pilot.
- **Decision:**

### D-37 Build plan vs other plans in Drive
- **This build:** Next.js PWA + NestJS + Postgres, PRD sprints S0–S13.
- **Drive "NUCCESS_Project_Proposal" (24 Oct):** a 3-week PWA MVP by a two-person team covering check-in, engine, safety and the free tools of all eight pathways, about $115/month on free tiers.
- **Drive "NUCCESS_System_Design_and_Project_Breakdown_2" (17 Oct):** a modular monolith, a 27-screen pilot of the core loop, and a Flutter Web admin dashboard.
- **Note:** these two documents haven't been read in full yet; they may set a different stack, scope or timeline.
- **Recommendation:** confirm which plan this build follows, then we read and reconcile the other.
- **Decision:**

### D-35 Missing and mismatched document versions
- **PRD and Activity:** both built against "Architecture & Screen Specification v3.1", which isn't in Drive (only v2, 2 Sep, and earlier screen specs).
- **PRD:** section 4 says its source is "v3.0"; S41 is labelled "NEW v3.3" in a v3.1 document; section 13 cites "Rules Engine v3.2".
- **Workbook README:** Tab 11 screen IDs are "S01–S40"; the PRD has S01–S41.
- **Figma:** frame numbers run S01–S162 and don't follow the PRD numbers after S13.
- **Recommendation:** treat the PRD S01–S41 list as the screen master and the Figma ↔ PRD table in `design/FLOWS.md` as the bridge, unless v3.1 turns up.
- **Decision:**

---

## Design details

### D-10 Navigation: no route to most screens
- **Figma:** no tab bar or menu. Home links to check-in, the eight pathways and quick dump. The avatar is the only possible way to Tasks, Progress, My Patterns, Reminders, Settings and the Notifications sheet.
- **PRD S05:** Home is a calm launch point; nothing on wider navigation.
- **Recommendation:** a small bottom bar (Home, Tasks, Progress, Me) with Help always top-right, or an avatar menu. Designer to choose.
- **Decision:**

### D-25 Heading typeface
- **Website build notes:** Figtree for headings, Atkinson Hyperlegible Next for body (also on the live site).
- **Figma:** headings use a serif typeface ("Good morning, AJ", "Let's take care of you first").
- **Recommendation:** follow Figma for the app if the serif is intended, and name the typeface; otherwise Figtree for brand consistency. Atkinson Hyperlegible Next for body either way.
- **Decision:**

### D-26 Feedback scale
- **PRD S30, FR-M13-01:** "Did this help? (yes / a bit / no)" and effort.
- **Figma S25:** helpful 1–5 and effort on a 5-point slider.
- **Recommendation:** follow Figma (1–5); map 1 → no, 2–3 → a bit, 4–5 → yes for the engine and analytics.
- **Decision:**

### D-27 Quiet hours default
- **Figma S87, S141:** 21:00–08:00. **Figma S48:** 22:00–07:30.
- **Recommendation:** 21:00–08:00.
- **Decision:**

### D-28 Body double named "Arraka"
- **Figma S20, S113:** the AI body double is called "Arraka".
- **Website (Team):** Arraka Wellness Hub is the founder's separate Lagos organisation.
- **Recommendation:** a neutral name, or no name ("Your body double"), unless the link is intended.
- **Decision:**

### D-30 Rule IDs on admin screens
- **Figma S147:** decision log shows rule IDs like "R-2.14", "D-6.11", "S-9.2".
- **Workbook:** patterns 1–41, gates RF-1–5 and MD-1–6, modifiers EX-1, CX-1, rules ENT-1–9.
- **Recommendation:** show the workbook IDs.
- **Decision:**

### D-31 Wins, stars and counts
- **PRD 1.4, 4.1, NFR-16:** no streaks, scores or failure framing, especially for Reflect.
- **Figma S134:** wins rated ★ Small / ★★ Medium / ★★★ Huge. S137 shows monthly counts (check-ins, sessions, steps). S135 "No streaks, just a quiet count".
- **Recommendation:** keep the size labels without stars; keep counts only in Progress.
- **Decision:**

### D-32 Pathway names on the website
- **Website (Services):** "Regulate, offload, express, connect, act, reflect or adapt" (7, with "offload" and "act"); app feature named "Brain Dump".
- **PRD, Figma:** 8 pathways: Regulate, Dump, Express, Execute, Adapt, Connect, Reflect, Meditate.
- **Recommendation:** update the website to the 8 app names.
- **Decision:**

### D-33 "Low-stimulation mode"
- **Website (app features, Comfort panel):** "Low-stimulation mode: calm colours, bigger text and less movement".
- **Figma S03, S89:** separate controls (text size, high contrast, reduce motion) and six themes, including "Quiet Pear, near-monochrome"; no single low-stimulation switch.
- **Recommendation:** add one "Low-stimulation" preset in Quick Setup that sets the quiet theme, larger text and reduced motion together.
- **Decision:**

---

## AI

### D-38 AI model per task
- **Decision already made:** open-source models, self-hosted, no cloud-provider lock-in (founder, 26 Oct 2026). The design uses Qwen3.5-4B (Apache-2.0) on llama.cpp for language and Whisper small.en on whisper.cpp for speech (backend `docs/SYSTEM_DESIGN.md` 4.3).
- **Still open:** which open model per task. It depends on speed on the real AI server and on the eval sets (4.3.8).
- **Options:** Qwen3.5-4B or Gemma 4 E4B for everything (tested head-to-head); Qwen3.5-2B for the classification tasks if those are too slow; Ministral 3 3B (Mistral AI, European) if neither runs reliably on llama.cpp; a GPU server with vLLM later if CPU speed holds back the Express tasks.
- **Speech:** Whisper small.en (default), or Gemma 4 E4B's built-in speech recognition if it matches Whisper on the speech test, which would mean one model instead of two.
- **Decision:**
