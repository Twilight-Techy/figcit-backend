# NUCCESS / Figcit source specifications

Reference copies of the product documents the app and backend are built against.
The originals live in Google Drive; if a copy here and the original disagree, the original wins.
Re-export rather than hand-editing these files.

| File | Source | What it is |
| --- | --- | --- |
| `nuccess-prd-frd-v3.1.md` | [Google Doc](https://docs.google.com/document/d/1Wlt_CEDx6NC9wUqZPwgo4jmrmP2-_2RLdRMXSikEvv4/edit) | PRD, FRD, user stories (M01–M19), sprint plan, QA, analytics |
| `nuccess-activity-tables-v2.1.md` | [Google Doc](https://docs.google.com/document/d/1GTwXyGbpihCxrHW25RLzLvDG4JjA1wbJBxU21RZa_PQ/edit) | Ordered activity tables, processes 1–12 |
| `rules-engine-v3.3/` | [Google Sheet](https://docs.google.com/spreadsheets/d/19dzYAKZsfjLEGc4XrV59BQewSx_78ew2vHNQryLWSTE/edit) | Recommendation Rules Engine v3.3: the authority for all engine rules. `.xlsx` original plus one CSV per tab |
| `website-copy-v2.md` | [Drive .docx](https://docs.google.com/document/d/1ex-YiqRRNbHr_nL4zTRtBlCthfmihme8/edit) | Website copy v2 (the site is live at https://figcit-website.vercel.app/) |
| `nuccess-privacy-notice-v0.1.md` | [Drive .docx](https://docs.google.com/document/d/1Oxz6hB8veizO0rQfn3bvfcSQdKIF5-OV/edit) | Draft privacy notice (pending legal review) |

UI designs are exported in the PWA repo under `design/` (Figma file `26iYxW66UY3vvAbpLKQEsT`, page "UI Design").

## Precedence

Rules Engine v3.3 → PRD/FRD v3.1 → Activity Tables v2.1 → Figma designs.
The engine workbook wins on any rule, threshold or state name; Figma wins on visual layout only.
