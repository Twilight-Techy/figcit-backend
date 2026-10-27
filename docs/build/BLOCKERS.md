# Blockers and workarounds

Things that couldn't be done or tested in the build container, what was done instead, and what a human needs to do.

| # | Blocker | Workaround | Human action |
| --- | --- | --- | --- |
| X-01 | Plan prices are not set (D-13, financial plan). | Seeded placeholder prices (Plus £6.99/month, £59.99/year, concession £3.49/month) as plan configuration; the UI reads them from the API. | Owner: set real prices in the `plans` table or admin; legal review of subscription wording (Tab 6d v3.3 open item). |
| X-02 | Safety phrases, the Hopeless-chip trigger (D-07), crisis copy and RF/MD prompts need Clinical Safety sign-off. | Built as written in the workbook plus a high-recall phrase list; flagged in admin review. | Clinical Safety, Partnership & Policy Director: review `packages/rules-compiler/src/catalogue/rules.ts` and Help copy. |
