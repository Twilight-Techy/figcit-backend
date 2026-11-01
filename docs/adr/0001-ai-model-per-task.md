# 0001: AI model per task

**Status:** Superseded in part by ADR 0003, which replaces the language model with Ministral 3 3B after runs on server-sized hardware. The evaluation below stands. Accepted 1 November 2026, by Twilight-Techy (tech lead; D-38's owner), from the
eval runs below. Issue #40. The timeouts are still to be set on the AI server (#32). Speech is in
ADR 0002.

## Context

SYSTEM_DESIGN §4.3.1 names three models:
- Qwen3.5-4B as the default;
- Gemma 4 E4B as an equal candidate;
- Qwen3.5-2B as a lighter option.

D-38 adds Ministral 3 3B (Mistral AI, European) in case neither runs reliably. §4.3.8 says the eval
sets choose the model per task.

The AI server (#32) doesn't exist yet. Every model therefore ran the `pnpm eval` harness (#39) on
the same development machine:
- a 2-core ARM VM with 7.8 GB of RAM;
- llama.cpp `b12020` (`llama-server`, one slot, 4096-token context);
- Q4_K_M files pinned by SHA-256;
- the same sets (version 1, `draft`) and prompts (`parse-need@3`, `suggest-drivers@2`,
  `break-down@2`).

The quality numbers carry over to the server. The speed numbers don't: the 4B models ran short of
memory and swapped.

## Results

Accuracy is as defined in `apps/api/src/modules/ai/evals/README.md`. No model needed a fallback or
produced a banned phrase in the runs below.

| Model | parseNeed (bar 85%) | suggestDrivers | breakDownTask (bar 100% within cap) | Peak memory |
| --- | --- | --- | --- | --- |
| Rules (fallback) | 54.0% | 48.0% | 100% | — |
| Qwen3.5-2B | 67.8% | 52.0% | 98.0% | not measured |
| Gemma 4 E2B | 83.9% | 42.0% | 96.0% | 4.8 GB |
| Ministral 3 3B | 87.4% | 44.0% | 98.0% | 5.0 GB |
| **Qwen3.5-4B** | **88.5%** | **58.0%** | **100%** | 6.4 GB |
| Gemma 4 E4B | **90.8%** | 56.0% | 96.0% | 6.2 GB |

- Every model kept 100% of its steps within the step cap.
- Every breakDownTask miss had the same cause: a step over 5 minutes for someone who is strained
  (Amber).
- The peak-memory figures include the memory-mapped model file, measured while the machine was
  swapping, so treat them as upper bounds.
- `urgent_help` came first for ordinary anxiety 4 times with Qwen3.5-2B and once with Gemma 4
  E2B. The other models never did it.

Latency on this machine, p50 for parseNeed: Qwen3.5-4B 9.6 s, Gemma 4 E4B 13.5 s, Ministral 3 3B
18.5 s. These can only be compared with each other; the AI server sets the real figures.

### Gemma 4 and thinking

Gemma 4 starts thinking before it answers, even with thinking switched off. With our system
prompt it used up `max_tokens` before writing any answer. Its first runs (an earlier draft of this
ADR) lost 46% to 82% of parseNeed answers to this.
- `--reasoning off` didn't stop it.
- `--reasoning-budget 0` fixed it for E2B but not for E4B. E4B then closed its thinking with a
  malformed tag, and the JSON grammar never applied.

The fix is a chat template that starts the model's turn with an empty thought block when thinking
is off. That's the Gemma 4 template plus one condition after the generation prompt
`<|turn>model\n`:

```jinja
{%- if not enable_thinking -%}{{- '<|channel>thought\n<channel|>' -}}{%- endif -%}
```

The server loads it with `--chat-template-file`. With it, E4B answered every case, and the
numbers above are from that run.

## Decision

- **Every language task uses Qwen3.5-4B**: parseNeed, suggestDrivers, breakDownTask, sortDump,
  the Express tasks and the Tab 11 tasks. This is the design's default.
  - It meets the parseNeed bar.
  - It is the best on suggestDrivers and breakDownTask.
  - It runs on stock llama.cpp with no template changes.
  - Gemma 4 E4B's 2.3-point lead on parseNeed is 2 of 87 sentences. That doesn't outweigh 4
    points worse on breakDownTask, slower output, and a custom template the server would depend
    on.
- **The lighter option is Ministral 3 3B, replacing Qwen3.5-2B.** Use it if Qwen3.5-4B turns out
  too slow on the server for the classification tasks. It meets the parseNeed bar (87.4%) with
  less memory. Qwen3.5-2B (67.8%) and Gemma 4 E2B (83.9%) don't meet it.
- **Gemma 4 E4B is the runner-up.** It isn't needed for speech either (ADR 0002), so nothing
  requires a second model family.
- **suggestDrivers keeps Qwen3.5-4B**, but its lead over the rules is small (58% against 48%).
  Give it an accuracy bar once the founder has reviewed the set.

## Consequences

- AI server (#32):
  - Serves Qwen3.5-4B Q4_K_M (`sha256 00fe7986…a11a4`), with Ministral 3 3B Q4_K_M
    (`sha256 9ed150d4…5f8`) loadable for the speed test.
  - Starts `llama-server` with `--reasoning-budget 0`, so no model's thinking can use up
    `max_tokens`.
  - Keeps the Gemma template change above in `docker/ai/` in case Gemma is ever served.
- **Final timeouts:** run `pnpm eval all` on the AI server and set each task's timeout to cover
  at least its p95 there.
- **Timeout fallback:** if Qwen3.5-4B can't meet those timeouts for the classification tasks,
  switch only those tasks to Ministral 3 3B. That's an AI config change, not a code change.
- **Strained steps:** `breakDownTask`'s check doesn't yet reject steps over 5 minutes for a
  strained person, and every model sometimes writes them. Tracked in #105.
- SYSTEM_DESIGN §4.3.1 still lists Qwen3.5-2B as the lighter option. This ADR replaces that line
  until the design is next edited.
- **Re-run every set** once the founder has reviewed the drafts, because results only compare
  within a set version.
