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

## Releases

Tag `engine-vX.Y.Z` on `main` once `package.json` and `ENGINE_VERSION` say `X.Y.Z` (a test keeps them equal). The **Engine release** workflow tests, builds (ESM + types) and publishes to GitHub Packages. Versions follow semver: any breaking change to `EngineInput`, `UserSignals`, `EngineResult` or the snapshot shape is a major version.

GitHub Packages names npm packages after the repository owner, so the package is published as `@<owner>/engine` (today `@twilight-techy/engine`) while code keeps importing `@figcit/engine`.

**Installing it** (the PWA, or any consumer):

1. Create a GitHub token with `read:packages` (in CI, `secrets.GITHUB_TOKEN` with `packages: read` works for repositories the package is shared with).
2. Add an `.npmrc` next to `package.json` (never commit the token itself):

   ```
   @twilight-techy:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
   ```

3. Depend on it under the import name: `"@figcit/engine": "npm:@twilight-techy/engine@^1.1.0"`.
