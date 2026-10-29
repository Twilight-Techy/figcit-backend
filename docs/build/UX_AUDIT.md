# UX audit

**Method.**
- Every route in the PWA's route table, plus `/help` (96 screens), was opened signed in as `ada@` (Plus, full history) in three modes:
  - light;
  - dark system theme;
  - 200% text (root font size doubled, the same as browser text zoom).
- Each screen was checked for:
  - sideways scrolling, and elements outside the viewport;
  - axe-core violations (light and dark);
  - a level-one heading;
  - page errors.
- Every screenshot was reviewed by eye on contact sheets.
- One journey per party was then run end to end against the local API and the seeded data (`SEED.md`).
- Browse journeys, the dark theme and 200% text are now in `figcit-pwa/e2e/journeys.spec.ts`, which CI runs in Chromium and WebKit.

## Results after the fixes

| Check | Light | Dark | 200% text |
|---|---|---|---|
| Screens that scroll sideways | 0 | 0 | 0 |
| axe violations | 0 | 0 | n/a |
| Screens without an h1 | 0 | 0 | 0 |
| Page errors | 0 | 0 | 0 |

The overflow check flags only the check-in body tabs, which are a deliberate horizontal scroller. Reminders' hidden switch labels are screen-reader-only text.

## What was wrong, and what changed

| # | Finding | Who it hit | Fix |
|---|---|---|---|
| 1 | **Dark mode never applied.** The device default ignored the system theme, and account comfort settings were never loaded onto a new device. Hana's strongest settings (A+++, dyslexic font, high contrast, low stimulation) only showed on the device where she'd set them. | Everyone with a dark phone; anyone signing in on a second device | Comfort follows the account (applied from `/me` at sign-in). The device follows the system by default, and changes live. (B-42) |
| 2 | Danger and positive buttons had white text on the dark theme's pale fills (contrast 2.0 and 1.7). This included "In danger now: call 999". | Dark theme | `on-strong` token |
| 3 | Two-column tile grids were cramped at 200% text: words broke mid-tile and the "Advanced" badges overflowed. | Large-text users | `grid-pair`: one column once text is enlarged |
| 4 | Icons such as ◔ (Progress tab, reminders, inbox) and ◍ (Me) rendered as a dot or a missing glyph on some devices. | Everyone, on some phones | `Glyph` draws the geometric set as SVG; the inbox has a bell |
| 5 | Home's state row squeezed the state text into a narrow column next to "Re-check" at large text. | Large text, dyslexic font | Row wraps |
| 6 | The card screen had no h1 (the card title was an h2 under a "For you" eyebrow). | Screen-reader users | Card title is the h1 |
| 7 | The content editor was a raw JSON textarea. | Content editor | A form: labelled fields per item, add, remove and reorder, identifiers read-only, codes generated for new items, a raw-JSON switch for the rest |
| 8 | `institution_supporter` did nothing, and staff MFA always went to `/admin/`. | Institution supporters | Sign-in routes by role: supporters to the dashboard, staff to the console. A supporter with no institution gets an explanation instead of a bare "not for you". (B-42) |
| 9 | Anyone could buy Plus with no adult check. | Under-18s | "I'm 18 or over" before checkout, enforced by the server (B-41) |
| 10 | The Advanced alternative couldn't be dismissed (ENT-3 "dismissing it is remembered"). | Free users | Dismiss button, remembered for 30 days (B-39) |
| 11 | The AI fallbacks (the only AI here, X-04) missed everyday words. "Can't focus, head is buzzing, exam tomorrow" found nothing, chip labels were cut mid-word ("I need someone to talk t"), and drafts pasted raw note lines. | Everyone using "in your own words" or Express | More phrases and feeling synonyms, setting cues ("too loud"), event tasks ("Exam tomorrow"), clipping on word boundaries, notes turned into sentences |
| 12 | Each page shipped every screen of its feature: Tasks +50 KB, Express +42 KB, Home 134 KB. | Slow networks | Pages import screens directly; sheets and voice capture load on demand. Every route is now within +40 KB; Home is 132 KB (B-37). |

## Journeys per party

| Party | Journey | Result |
|---|---|---|
| Browse (no account) | Welcome → skip → consent → Home → full check-in → card; offline | Works offline, with the device engine. Dark theme follows the system. In CI (both engines). |
| Free (`ben@`) | Home → Plans → choose → pay (age already confirmed in the seed) | OK; age switch shown only when unconfirmed |
| Plus (`ada@`) | All 96 screens, three modes | See results above |
| Strong comfort settings (`hana@`) | Sign in on a fresh device | Theme, A+++ text, contrast, motion, dyslexic font and low stimulation all apply at sign-in |
| Share recipient | Ada creates a share; a second browser opens `/shared/?t=…` | Read-only summary: lights, what helped, plain-words notes, expiry date |
| Institution lead (`lead@`) | Sign in → TOTP → lands on the institution dashboard → support requests | OK (dashboard trends above the anonymity floor; Dee's request) |
| Institution supporter without an institution (`supporter@`) | Sign in → TOTP | Lands on the dashboard and is told how to get added |
| Content editor (`editor@`) | Open `comm.cards` → add an item → submit | Draft "waiting to publish", published by someone else |
| Admin and safety reviewer | Console, snapshots, safety queue, audit | Unchanged; covered by the earlier admin journey |

## Not covered here

- Real VoiceOver and TalkBack passes and a mid-range Android device. These need hardware (ENGINEERING_RULES §8).
- Real-model AI output quality (X-04).
- WebKit locally: the container has only Chromium. CI runs the journeys in WebKit.
