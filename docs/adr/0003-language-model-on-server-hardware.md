# 0003: Language model and timeouts on server-sized hardware

**Status:** Accepted, 1 November 2026, by Twilight-Techy (tech lead; D-38's owner). Issue #107.
Supersedes ADR 0001's choice of language model. ADR 0001's evaluation and ADR 0002 (speech)
stand.

## Context

ADR 0001 chose Qwen3.5-4B from runs on a 2-core development VM that was swapping. It left speed
and timeouts to "the AI server", with Ministral 3 3B as the fallback if Qwen3.5-4B was too slow.

These runs used hardware sized like the design's AI server (§11: about 8 cores and 16–32 GB, CPU
only). That was a Modal container with 8 vCPUs and 16 GB, in `us-east`. All the data is
synthetic, so no user text left our systems. Production must still run in the UK or EU. Otherwise
the setup matches ADR 0001:
- llama.cpp `b12020` (`llama-server`, one slot, 4096-token context, `-t 8`,
  `--reasoning-budget 0`), with the same model files, sets and prompts;
- whisper.cpp v1.9.5, built with runtime CPU detection. A portable build without it lacks AVX2
  and was 13 times slower.

The evals ran from the development machine, so each latency includes the network round trip.

## Results

| On 8 CPUs | parseNeed | suggestDrivers | breakDownTask |
| --- | --- | --- | --- |
| Qwen3.5-4B, accuracy | 89.7% | 52.0% | 98.0% |
| Qwen3.5-4B, p50 / p95 | 3.8 s / 10.0 s | 3.0 s / 3.5 s | 12.1 s / 24.3 s |
| Qwen3.5-4B, inside today's timeout | 85% | 100% | 90% |
| **Ministral 3 3B**, accuracy | 87.4% | 50.0% | 98.0% |
| **Ministral 3 3B**, p50 / p95 | 3.1 s / 4.0 s | 1.1 s / 1.6 s | 4.2 s / 8.1 s |
| **Ministral 3 3B**, inside today's timeout | **100%** | **100%** | **100%** |

- Both models meet the parseNeed accuracy bar. Both keep 100% of steps within the cap, and
  neither produced a banned phrase.
- The accuracy gaps are 2 of 87 sentences (parseNeed) and 1 of 50 tasks (suggestDrivers).
- Ministral 3 3B fell back on 1 of 50 breakDownTask cases. Qwen3.5-4B had no fallbacks.

**Why Qwen3.5-4B is slower.** Both models generate at about the same rate here (12 to 14 tokens
per second). The difference is in reading the prompt:
- **Ministral 3 3B** keeps the fixed system prompt cached between calls, as §4.3.4 intends. Its
  second call read only the 13 new tokens.
- **Qwen3.5-4B** reads the whole prompt again on every call: 369 tokens, about 4.8 s. Its hybrid
  (part recurrent) architecture can't reuse a cached prefix in this llama.cpp version.

So Qwen's extra latency comes from the architecture and will apply on any CPU server.

**Speech** (ADR 0002's set) on the same hardware: Whisper small.en with VAD had a 2.3% word error
rate, no invented text and no failures, at 1.8 s / 1.9 s (p50 / p95) per clip.

## Decision

- **Ministral 3 3B for every language task**, replacing Qwen3.5-4B:
  - its accuracy matches Qwen within one or two cases on every set;
  - it meets every timeout with room to spare;
  - its prompt caching works;
  - it's the smaller download and memory footprint.

  It's also European (Mistral AI, Apache-2.0).
- **Qwen3.5-4B is the alternative.** Reconsider it if llama.cpp gains prefix caching for its
  architecture, or on a GPU server with vLLM.
- **Timeouts are about twice the p95 on 8 CPUs, rounded:**

  | Task | Before | Now | Ministral p95 |
  | --- | --- | --- | --- |
  | parseNeed | 8 s | 8 s | 4.0 s |
  | suggestDrivers | 8 s | **4 s** | 1.6 s |
  | breakDownTask | 20 s | **16 s** | 8.1 s |

  The other tasks keep their timeouts until they have eval sets: mapFeeling, splitTasks, sortDump
  and the Express tasks.
- **Speech stays Whisper small.en (ADR 0002).** The speech job runs in the background, so its
  latency needs no new timeout.

## Consequences

- `AI_MODEL` defaults to `ministral-3-3b-instruct-q4_k_m`. The nightly eval job runs Ministral 3
  3B Q4_K_M (`sha256 9ed150d4…5f8`) when no AI server is configured.
- The AI server (#32):
  - serves Ministral 3 3B Q4_K_M with `--reasoning-budget 0`;
  - runs whisper.cpp built with `GGML_BACKEND_DL` and `GGML_CPU_ALL_VARIANTS` (or `-march=native`
    on a fixed host), never a plain portable build.
- `llama-server` here ran one slot. Check the timeouts again under `--parallel` and real load.
  Tighten them only when the eval's "inside the timeout" stays at or above 95%.
