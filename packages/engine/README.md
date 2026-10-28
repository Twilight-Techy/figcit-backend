# @figcit/engine

The NUCCESS decision engine. Pure TypeScript with **no runtime dependencies**, shared by the API and the PWA (rules 2.2).

```
src/
  index.ts      public API: evaluate(), evaluateRecheck(), types
  stages/       stages 0–12, one file per stage (SYSTEM_DESIGN 5.2)
  patterns/     patterns P01–P41, one small typed function each
  gates/        RF-1–RF-5, MD-1–MD-6
  safety/       Aho–Corasick phrase matcher (stage 0)
test/           unit, fixture and property tests; *.bench.ts for budgets
fixtures/       generated from the workbook by `pnpm fixtures:generate` (never hand-edit)
```

Banned inside `src/`: `node:*` imports, `Date`, `Math.random`, `process`, `console`, timers, network and file access. Time and randomness are passed in.
