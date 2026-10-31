# AI evals

Every AI task is measured for quality and speed before it's switched on (SYSTEM_DESIGN §4.3.8).

```bash
AI_BASE_URL=http://127.0.0.1:8080 AI_MODEL=qwen3.5-4b-q4_k_m pnpm eval parseNeed
pnpm eval all --rules      # the rule-based fallbacks, no model: the baseline to beat
```

- `parseNeed`, `suggestDrivers`, `breakDownTask` or `all`. `--limit N` runs the first N cases;
  `--strict` exits 1 when a pass bar is missed.
- Each call goes the way `AiService` sends it: the scrubbed text, the task's prompt and JSON
  schema, then zod and the task's checks. A case that fails a check counts as a fallback.
- Calls may take up to `EVAL_TIMEOUT_MS` (default 120 s) so a slow CPU still gets scored. Speed is
  judged separately, against each task's own timeout.
- Results go to `var/evals/` (not committed): a JSON file and a markdown summary per task and
  model. Each run is compared with the last one for the same task and model.

## What is measured

| Measure | Meaning |
| --- | --- |
| Accuracy | `parseNeed`: the first need is one the case accepts. `suggestDrivers`: every driver is accepted, and none only when none fit. `breakDownTask`: within the step cap, steps of 5 minutes or less when strained, one action per step |
| Within the hard rule | `breakDownTask`: the model's steps fit the step cap, judged even when another check failed |
| Banned-phrase hits | Any banned phrase (`text.ts`) anywhere in the output |
| Fallback rate | Calls whose answer the user would not see: invalid, timed out or failed |
| Within the task timeout | Calls answered inside the task's production timeout |
| Latency p50 / p95, tokens per second | From the model calls |

Pass bars (SYSTEM_DESIGN §4.3.8): `parseNeed` accuracy ≥ 85%; `breakDownTask` 100% within the
step cap; no banned phrases; 95% of calls inside the timeout. `suggestDrivers` has no accuracy bar
yet.

## The sets

`sets/*.json`, parsed with zod. The examples are synthetic, never real user text. Version 1 is a
**draft** written by the build team: the design asks for the sets to be written with the founder,
so each set's `status` stays `draft` until the founder has reviewed it, then becomes `reviewed`.
Bump `version` whenever cases change, because results are only comparable within a version.

- `parse-need.json`: sentences and the need codes accepted as the first need (two where the
  sentence honestly fits both). Includes three prompt-injection attempts. No crisis wording: the
  safety check stops that before the model.
- `suggest-drivers.json`: task titles and the drivers that fit. Never urgency, which comes from
  the timeline.
- `break-down-task.json`: tasks with a step cap from the timelines (3, 5, 8, 10) and whether the
  person is strained (Amber).

## Nightly

`.github/workflows/ai-evals.yml` runs every set at 02:00 UTC against `AI_EVAL_BASE_URL` (secret)
when it's set, and otherwise against a pinned model on the runner's CPU. The summary is on the
run page and the results are kept as an artifact and in the cache for the next comparison.
