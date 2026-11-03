# 0005: Decision scoring for the classification tasks

**Status:** Proposed, 2 November 2026. Spike for issue #112. Adopting it means changing the AI
tasks, which is separate work.

## Context

Our CPU AI server handles about one call at a time (ADR 0004). Most of each classification call is
spent writing JSON. TypeSafe's Jev (September 2026) instead answers fixed-choice questions with
probabilities from a single pass over the prompt: it writes no text. The hosted API is ruled out
by D-23, because user text would go to a third-party AI company. But the technique is open
(`llm2jev`, MIT), and it works on our own model.

`pnpm eval:decide` (`apps/api/src/modules/ai/evals/decide.ts`) does this on llama.cpp:
- the options are listed under single-letter labels;
- the model writes one token;
- the label probabilities come from `top_logprobs`, renormalised over the labels.

Both modes ran on the same Modal endpoint, one after the other, with synthetic data:
- 8 vCPUs and 16 GB, one slot;
- Ministral 3 3B Q4_K_M on llama.cpp `b12020`;
- the same eval sets, scored by the same rules.

## Results

| Task | Mode | Accuracy | p50 | p95 |
| --- | --- | --- | --- | --- |
| parseNeed (first need) | Generative JSON (today) | 86.2% | 5.5 s | 6.9 s |
| parseNeed (first need) | **Decision, one call over all 22 needs** | **85.1%** | **0.31 s** | **0.38 s** |
| suggestDrivers | Generative JSON (today) | 48.0% | 2.2 s | 4.6 s |
| suggestDrivers | **Decision, one call over 7 drivers + "none", keep each ≥ 0.20** | **78.0%** | **0.28 s** | **0.33 s** |
| suggestDrivers | Decision, 7 yes/no calls, best threshold (0.7) | 42.0% | 2.0 s | 2.1 s |

**parseNeed**
- About the same accuracy (one sentence of 87), 18 times faster.
- The probabilities are useful. In 67 of 87 cases the top need had probability 0.7 or more, and
  95.5% of those were right. Below 0.7 only half were right. Those are the cases where the app
  already shows the need list (S11), rather than guessing.

**suggestDrivers**
- One call that lists all the drivers beat generative JSON by 30 points and was 8 times faster.
  Asking one yes/no per driver did badly: the model said yes too readily.
- The 0.20 threshold was chosen on the set itself. To check it wasn't luck, it was chosen on one
  half of the set and scored on the other, both ways round. Both halves chose 0.20, and it scored
  72% and 84% on the held-out halves.

**What decision scoring can't do.** It picks from options and writes nothing. parseNeed's "heard"
chips and task title, breakDownTask, splitTasks and the Express tasks still need generation.

## Decision (proposed)

- **Use decision scoring for the classification parts of the AI tasks:**
  - parseNeed's needs, `supportOnly` and task type;
  - suggestDrivers (one call, threshold 0.20) and its demand traits;
  - mapFeeling, where the per-chip probability is the confidence the S91 "Is it more like X or
    Y?" flow needs;
  - sortDump's buckets.

  Generation stays for text. For parseNeed, one decision call picks the needs, and a short
  generative call writes the chips and title only when the screen shows them.
- **Keep the rule fallbacks.** A decision call can still time out, and the rules stay the floor.
- **Expected effect:** classification calls go from several seconds to about 0.3 s on CPU. That
  multiplies what one CPU server handles, which should delay the need for a GPU (ADR 0004).

## Before adopting it

- **Bigger sets:** confirm on the founder-reviewed sets and a larger held-out set. These ran on
  version 1 drafts with 50 to 87 cases each.
- **Missing sets:** add eval sets for mapFeeling and sortDump. They have none yet.
- **Thresholds:** set the "confident enough to pre-select" threshold for parseNeed and the
  driver threshold from those sets, and record them in the tasks with their prompt versions.
- **Server check:** check that the AI server's llama.cpp returns `top_logprobs` the same way
  (#32). Option labels must stay single tokens for the model in use.
