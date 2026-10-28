# Blockers and workarounds

Things that couldn't be done or tested in the build container, what was done instead, and what a human needs to do.

| # | Blocker | Workaround | Human action |
| --- | --- | --- | --- |
| X-01 | Plan prices are not set (D-13, financial plan). | Seeded placeholder prices (Plus £6.99/month, £59.99/year, concession £3.49/month) as plan configuration; the UI reads them from the API. | Owner: set real prices in the `plans` table or admin; legal review of subscription wording (Tab 6d v3.3 open item). |
| X-02 | Safety phrases, the Hopeless-chip trigger (D-07), crisis copy and RF/MD prompts need Clinical Safety sign-off. | Built as written in the workbook plus a high-recall phrase list; flagged in admin review. | Clinical Safety, Partnership & Policy Director: review `packages/rules-compiler/src/catalogue/rules.ts` and Help copy. |

## X-03: Advanced social spaces (body-doubling rooms, peer spaces, check-in buddy)
These need a moderated real-time service and safeguarding decisions that don't exist yet. `GET /connect` returns `rooms.available: false` and the app shows "coming soon". Everything else in Connect works (trusted people, starters, groups, send via the phone's own apps).

## X-04: No model server in this container
Every AI task runs through its rule-based fallback here. The real-model path is tested end to end against a fake OpenAI-compatible server (`apps/api/test/fake-model.ts`): constrained output, checks, replace-on-failure, circuit breaker and SSE streaming. Quality of real model output (Qwen3.5-4B) still needs the week-1 test from SYSTEM_DESIGN §4.3.8.

## X-05: Research dataset pipeline
S149 needs a separate de-identified store, ethics approval and a consent version for research. The screen is built with Generate disabled; the `research` consent purpose is already recorded.

## X-06: Web Push keys
`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` aren't set here, so `GET /push/vapid-key` returns null and the app says push isn't set up; every reminder still lands in the inbox (B-23). Set the keys to turn push on.

## X-07: No speech server
Voice capture records on the device, but there is no Whisper server in this container, so transcription returns "not available" and the screens offer typing (Express keeps the recording to save). Point `WHISPER_URL` at a whisper server to enable it.
