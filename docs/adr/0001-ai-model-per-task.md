# 0001: AI model per task

**Status:** Proposed. Waiting for the founder's agreement (D-38), and for speed numbers from the AI
server (#32). Issue #40.

## Context

SYSTEM_DESIGN §4.3.1 names Qwen3.5-4B as the default model, Gemma 4 E4B as an equal candidate, and
Qwen3.5-2B as a lighter option. §4.3.8 says the eval sets pick the model per task and set the final
timeouts. D-38 leaves the choice open until then.

The AI server (#32) doesn't exist yet. So these runs used the `pnpm eval` harness (#39) on a
development machine: a 2-core ARM VM with 7.8 GB of RAM, llama.cpp `b12020` (`llama-server`, one
slot, 4096-token context), and Q4_K_M files pinned by SHA-256. The quality numbers carry over to
the server. The speed numbers don't: on this machine the 4B models ran short of memory and went
into swap.

The sets are version 1 and still `draft` (not yet reviewed by the founder). The prompts are
`parse-need@3`, `suggest-drivers@2` and `break-down@2`.

## Results

Accuracy as defined in `apps/api/src/modules/ai/evals/README.md`. "Fallback" means calls whose
answer the user would not see. Latency and speed are from the development machine only.

**parseNeed** (87 sentences; pass bar 85%)

| Model | Accuracy | Fallback | `urgent_help` first | p50 / p95 | Tokens/s |
| --- | --- | --- | --- | --- | --- |
| Rules (fallback) | 54.0% | — | 0 | — | — |
| Qwen3.5-2B | 67.8% | 0% | 4 | 11.2 s / 15.7 s | 7.5 |
| Gemma 4 E2B | 83.9% | 0% | 1 | 11.3 s / 13.8 s | 5.8 |
| **Qwen3.5-4B** | **88.5%** | 0% | 0 | 9.6 s / 22.5 s | 2.9 |
| Gemma 4 E4B | 50.6% (93.6% of the 47 it answered) | 46% | 0 | 41.2 s / 53.1 s | 3.5 |

**suggestDrivers** (50 tasks; no accuracy bar yet)

| Model | Accuracy | Fallback | p50 / p95 |
| --- | --- | --- | --- |
| Rules (fallback) | 48.0% | — | — |
| Qwen3.5-2B | 52.0% | 0% | 4.9 s / 6.0 s |
| Gemma 4 E2B | 42.0% | 0% | 5.7 s / 6.7 s |
| **Qwen3.5-4B** | **58.0%** | 0% | 7.5 s / 8.8 s |
| Gemma 4 E4B | 52.0% | 0% | 10.7 s / 12.1 s |

**breakDownTask** (50 tasks; pass bar 100% within the step cap)

| Model | Accuracy | Within cap | Fallback | p50 / p95 |
| --- | --- | --- | --- | --- |
| Rules (fallback) | 100% | 100% | — | — |
| Qwen3.5-2B | 98.0% | 100% | 2% | 15.3 s / 30.2 s |
| Gemma 4 E2B | 96.0% | 100% | 0% | 14.5 s / 26.7 s |
| **Qwen3.5-4B** | **100%** | 100% | 0% | 29.2 s / 48.6 s |
| Gemma 4 E4B | 94.0% | 100% | 0% | 33.2 s / 61.7 s |

No model produced a banned phrase. Peak resident memory of `llama-server`: Gemma 4 E2B 4.8 GB,
Gemma 4 E4B 6.1 GB, Qwen3.5-4B 6.4 GB. These include the memory-mapped model file, and the
machine was swapping during the 4B runs, so treat them as upper bounds.

### Gemma 4 and thinking

Gemma 4 thinks before answering unless told not to. Our client's `enable_thinking: false` is
Qwen's setting; Gemma's template ignores it.

- **E2B:** with no server flags, 82% of parseNeed calls came back empty: the whole 200-token
  budget went on thinking. `--reasoning off` didn't stop it. `--reasoning-budget 0` did, and those
  are the numbers above.
- **E4B:** with `--reasoning-budget 0`, it still starts thinking in 46% of parseNeed calls. It then
  closes the block with a malformed tag (`s</channel>`), so llama.cpp never sees the thinking end
  and never applies the JSON grammar. On the cases it answered, it was the most accurate model
  (93.6%). Its parseNeed result measures this llama.cpp and template problem, not the model.

## Decision (proposed)

- **Every task uses Qwen3.5-4B**, the design's default. It is the only model that meets the
  parseNeed bar, it is the best or equal best on every set, and it never needed a fallback.
- **Gemma 4 E4B stays a candidate.** Re-test it on the AI server's pinned llama.cpp once its
  thinking can be switched off reliably. Its answered parseNeed cases suggest it could beat
  Qwen3.5-4B.
- **Lighter option: Gemma 4 E2B, not Qwen3.5-2B**, if the 4B is too slow on the server for
  the classification tasks. It scored 83.9% against 67.8% on parseNeed. It is not one of the
  design's listed candidates, so adopting it needs the founder's agreement too.
- **suggestDrivers:** no model is far above the rules (best 58% against 48%). Before choosing a
  model for it, decide whether its AI call earns its cost, and set an accuracy bar.
- **Final timeouts: not proposed here.** They need latency from the AI server (#32). Run
  `pnpm eval all` there, and set each timeout to cover at least the p95.

## Consequences

- Whatever model runs, the AI server's `llama-server` must start with `--reasoning-budget 0`, so a
  model's thinking can never use up `max_tokens` and leave the answer empty (#32).
- D-38 in `docs/CONFLICTS.md` is updated only after the founder agrees.
- Still to run: Ministral 3 3B (in #40's list, not run here); all models on the AI server; and
  every set again once the founder has reviewed it, because results only compare within a set
  version.
