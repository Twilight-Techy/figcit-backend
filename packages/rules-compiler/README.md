# @figcit/rules-compiler

Turns `docs/specs/rules-engine-v3.3/` (the workbook) into:

- a **snapshot JSON** the engine loads (validated with zod, hashed with SHA-256);
- **engine fixtures** from Tabs 0, 0b, 6d, 9 and 10 into `packages/engine/fixtures/`.

Lane A owns this package (WORKFLOW §2).
