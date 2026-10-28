# Seed data

`pnpm --filter @figcit/api db:seed` publishes the plans, tools and rule snapshot, then the demo personas. `pnpm --filter @figcit/api db:seed:personas` re-creates only the personas. Both are safe to run again, and safe on a shared database: the persona step only touches accounts on `@nuccess.test` (wiped and re-created each run) and the `demo-` institution. Set `SEED_PERSONAS=false` to skip personas.

To seed an external database: set `DATABASE_URL` (and the other required values from `.env.example`, especially `MASTER_KEYS`, which encrypts the demo data) in `.env`, then run `pnpm --filter @figcit/api db:migrate` and `pnpm --filter @figcit/api db:seed`.

**Signing in:** every demo account uses the password `Nuccess-demo-2026!`, or a magic link (in development the email lands in `GET /v1/dev/mailbox`). Staff accounts also need a two-step code from an authenticator app set up with the secret `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP`. These are demo values: never reuse them anywhere real.

| Account | What it shows |
| --- | --- |
| `ada@nuccess.test` | Plus (monthly). Two months of use: every light including Blue recovery after re-checks, sessions with "did it help?", tasks (one broken down, one recurring, one done, one from a dump), sorted dump, drafts with a simplified version, reflections (topic repeated, a win, a journal entry, one saved for later), a prayer practice with a schedule and a ritual, two trusted people, a support plan, reminders, a live share. Patterns and progress are full. |
| `ben@nuccess.test` | Free, two days old: a Green check-in and a "Not sure" one. Empty states everywhere else. |
| `chi@nuccess.test` | Free, Lagos time zone. Fifteen hard days (mostly Red, some Amber), then a check-in with a risk phrase: crisis routes, safety events, SF-2 prompt in the inbox after the daily job. One trusted person for SOS. |
| `hana@nuccess.test` | Comfort settings at their strongest (largest text, dark low-stimulation theme, dyslexic font, high contrast, reduced motion, sound and haptics off, silent notifications, quiet hours 20:00–09:00), pattern prompts and personalisation off, "meditation makes me feel worse". |
| `fin@nuccess.test` | Plus (yearly), cancelled: still Plus for 10 more days. |
| `gus@nuccess.test` | Asked to delete the account: in the 30-day grace period. Signing in with a magic link brings it back. |
| `admin@`, `safety@`, `editor@`, `supporter@nuccess.test` | Staff: admin, safety reviewer, content editor, institution supporter. |
| `lead@nuccess.test` | Support lead at **Northbridge University** (invite code `NORTH2026`, anonymity floor 20): dashboard trends and a support request from Dee. |
| `student01@nuccess.test` (Dee) … `student60@` | University members who share group trends; Dee asked for support. `private-student@` joined but doesn't share, so is never counted. |
