# 0006: Final AI decisions for every task

**Status:** Accepted, 2 November 2026, by Twilight-Techy (authorised to decide every item).
Issues #105, #109, #115 and #117. This brings ADR 0001 to ADR 0005 together, and adds the tasks
that had no eval set before.

## Context

Before this, only parseNeed, suggestDrivers and breakDownTask had eval sets. mapFeeling,
splitTasks, sortDump and the Express tasks ran on default prompts and timeouts that nobody had
measured. #115 added a set for each, and every task ran on the same 8-CPU server:
- Ministral 3 3B Q4_K_M on llama.cpp `b12020`;
- one slot;
- synthetic data only.

#117 built decision scoring (ADR 0005) into the app. The numbers below come from the app's own task
code.

## Decision: every AI feature

All tasks use **Ministral 3 3B** (D-38, ADR 0003) on our own server, behind the same safety screen,
limits, logging and rule fallback. Accuracy and timing are on 8 CPUs.

| Feature | Task | Mode | Accuracy | p50 / p95 | Timeout | When AI fails or is slow |
| --- | --- | --- | --- | --- | --- | --- |
| "In your own words" (S91) | `parseNeed` | Generate JSON | 86.2% (bar 85%) | 3.8 s / 4.8 s | 20 s (8 s until 7 Nov 2026: too tight on Modal, ADR 0009) | Need list |
| Task card drivers | `suggestDrivers` | **Decision** | **78.0%** (was 50%) | 0.43 s / 0.46 s | 4 s | Keyword rules |
| Feeling chips from words | `mapFeeling` | **Decision** | **83.3%** (was 81.7%) | 0.45 s / 0.50 s | 8 s | Keyword rules |
| Break it down | `breakDownTask` | Generate JSON | 98.0%, 100% within cap | 12.9 s / 19.4 s | **24 s** | Step templates, shown at once |
| Split into tasks | `splitTasks` | Generate JSON | 77.8% | 1.5 s / 2.2 s | 6 s | Rule split |
| Dump sorting (Advanced) | `sortDump` | Generate JSON | 75.0%, no worry as todo | 4.5 s / 5.2 s | 20 s, background | Manual sorting |
| Simplify | `simplify` | Generate text, streamed | 100% | 1.2 s / 2.1 s | 45 s | Keep the original |
| Rewrite | `rewrite` | Generate text, streamed | 100% | 1.5 s / 2.1 s | 45 s | Keep the original |
| Draft (Advanced) | `draft` | Generate text, streamed | 100% | 1.6 s / 2.5 s | 45 s | Fill-in template |
| Structure (Advanced) | `structure` | Generate JSON | 100% | 12.2 s / 21.5 s | 45 s | Fill-in template |
| Script (Advanced) | `script` | Generate JSON | 91.7% | 12.8 s / 23.1 s | 45 s | Fill-in template |
| Card reason | `rewordReason` | **Off** | — | — | — | Approved templates only (by design) |
| Voice to text | Whisper small.en + VAD | Background job | 2.3% WER, no invented text | 1.8 s per clip | — | Type instead |

No task produced a banned phrase.

**What "accuracy" means.** For the Express tasks it measures only that the answer passed its checks:
- no new names, dates or numbers;
- no banned phrases;
- shorter, for simplify;
- an ask section for structure, and an opening line for script.

Writing quality still needs a human read.

### Why each mode

- **Decision scoring**, where the answer is a choice: suggestDrivers (+28 points, 3 times faster)
  and mapFeeling (+1.6 points, 5 times faster). mapFeeling's probability is also its confidence,
  so it decides what shows pre-selected (0.7 or more) and when the app asks "Is it more like X or
  Y?".
- **Generation:**
  - **sortDump:** decision scoring did worse (60% against 75%), and sortDump runs in the
    background anyway.
  - **parseNeed:** decision scoring was level (85.1% against 86.2%), and its "We heard" chips and
    task title need text.
  - **Everything else** produces text.

## Fixed along the way

- **Strained steps (#105):** someone who is strained (Amber) only gets steps of 5 minutes or less.
  The schema caps them, so the model can't write longer ones.
- **Express prompts:** these now say who is speaking and define each role and cue. They forbid
  placeholders, analysis and invented facts. This took draft from 75% to 100%, structure from 33%
  to 100%, and script from 8% to 92%.
- **The invented-facts check:** a capitalised first word ("Sorry,", "Okay,") no longer counts as a
  new name. Before this, good answers fell back to templates.
- **Script:** its opening line is labelled as what the person says first.

## Other decisions

- **Hosting:** one UK/EU CPU AI server at launch (ADR 0004).
  - It runs the containers in `docker/ai/` (#32): pinned, model-hash-checked, with token auth and
    on a private network.
  - Add an always-on UK/EU GPU server only when `ai_calls` shows calls slipping past their
    timeouts at peak.
- **Serverless GPU (Modal): not for production** (D-40, #109). Its capacity waits are unbounded
  (796 s seen), and it would be a new processor of user text. It stays allowed for evals with
  synthetic data.
- **Eval sets:** version 1 of every set is the working baseline. They stay `draft` until someone
  reads them line by line and marks them `reviewed`. Results only compare within a set version.
- **When to re-run:** run `pnpm eval all` on the AI server once it exists, and before any prompt
  or model change. The nightly job keeps running it.
