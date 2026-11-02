# 0004: AI capacity on CPU and GPU

**Status:** Accepted, 2 November 2026, by Twilight-Techy (tech lead). Issue #110. Whether Modal may
serve production traffic is a separate decision for the founder (#109).

## Context

ADR 0003 chose Ministral 3 3B on an 8-CPU server, but it measured one request at a time. This ADR
answers three further questions:
- How many calls does one CPU server handle?
- What would a GPU add?
- Is a serverless GPU with the CPU as its fallback workable?

All the runs below used Modal (`us-east`), synthetic data only, and the same llama.cpp `b12020`
build, model files, sets and prompts as ADR 0001 and ADR 0003:
- **CPU:** 8 vCPUs and 16 GB.
- **GPU:** one NVIDIA L4 (24 GB), with llama.cpp's CUDA build and every layer on the GPU.
- **Whisper:** whisper.cpp v1.9.5 with CUDA.

Each latency includes the network round trip from the development machine.

## Results

### Accuracy and speed on GPU

All five models, every set, one request at a time:

| Model | parseNeed (bar 85%) | suggestDrivers | breakDownTask | parseNeed p50 / p95 | Inside timeout |
| --- | --- | --- | --- | --- | --- |
| Qwen3.5-2B | 65.5% | 40.0% | 96.0% | 1.2 s / 1.6 s | 100% |
| Gemma 4 E2B | 82.8% | 42.0% | 98.0% | 1.2 s / 1.5 s | 100% |
| **Ministral 3 3B** | 87.4% | **58.0%** | **100%** | 1.4 s / 1.7 s | 100% |
| Qwen3.5-4B | 88.5% | **58.0%** | **100%** | 0.7 s / 2.0 s | 100% |
| Gemma 4 E4B | **90.8%** | 52.0% | 98.0% | 1.0 s / 2.5 s | 100% |

- Accuracy is the same as on CPU (ADR 0001, ADR 0003) to within a case or two per set, which is
  GPU arithmetic noise.
- On GPU every model meets every timeout. Qwen3.5-4B's prompt problem (ADR 0003) disappears,
  because re-reading the prompt is cheap on a GPU.
- Generation ran at 40 to 140 tokens per second, against about 13 on CPU.

### Load: one server, Ministral 3 3B, four slots

`pnpm eval:load` mixes parseNeed, suggestDrivers and breakDownTask calls, with every call judged
against its production timeout.

| Callers at once | CPU: calls/min | CPU: answered in time | GPU: calls/min | GPU: answered in time |
| --- | --- | --- | --- | --- |
| 1 | 12 | **100%** | 42 | **100%** |
| 2 | 16 | 64.5% | 58 | **99.1%** |
| 4 | 25 | 38.8% | 100 | **100%** |
| 8 | 30 | 5.1% | 116 | **99.6%** |
| 16 | 32 | 3.2% | 120 | 42.7% |

- **One CPU server serves about one AI call at a time**, about 12 a minute, within its timeouts.
- **One L4 serves about 8 at a time**, about 115 a minute: roughly 10 times the CPU.
- These figures are lower bounds. Modal's proxy doesn't pass on a caller hanging up, so the test
  waits for every call. llama-server cancels a call when its caller disconnects directly, so in
  production late calls free capacity sooner.

### Cold starts: from zero containers to the first answer

| Endpoint | Times |
| --- | --- |
| CPU, Ministral 3 3B | 10.7 s, 12.8 s, 12.4 s |
| GPU, Ministral 3 3B | **796 s** (waiting for an L4), then 7.2 s and 10.6 s |
| For comparison: the natlas vLLM app on GPU | 71.5 s |

llama.cpp loads a 2 GB model in seconds, so a cold start costs about 10 s on either. The real risk
on a serverless GPU is waiting for capacity: the first call waited more than 13 minutes for an L4.
The workspace also ran one L4 at a time for most of the session.

### Speech on GPU

On the same 50 clips (ADR 0002):

| Model | Word error rate | Invented text | p50 / p95 per clip |
| --- | --- | --- | --- |
| **Whisper small.en + VAD** | **2.3%** | **0** | **0.22 s / 0.36 s** (CPU: 1.8 s / 1.9 s) |
| Gemma 4 E4B audio | 3.8% | 10 (every clip with no speech) | 0.92 s / 1.36 s |

## Decision

- **The model stays Ministral 3 3B (ADR 0003).**
  - On GPU it ties Qwen3.5-4B (87.4% / 58% / 100% against 88.5% / 58% / 100%).
  - It's the only one of the two that meets its timeouts on CPU.
  - So the CPU server and any GPU can run the same model and give the same answers.
- **Speech stays Whisper small.en (ADR 0002).** GPU makes it 8 times faster. But transcription
  runs in the background, so the CPU's 1.8 s per clip is already enough.
- **Launch on one CPU server.** That suits light AI use: about one call at a time. Each AI feature
  falls back to its rules when the server is busy, so overload makes help worse but breaks
  nothing.
- **Add a GPU when `ai_calls` shows it's needed.** The signs are:
  - calls landing inside the timeout dropping below 95% at peak;
  - the fallback rate rising;
  - Express drafts running long.

  One L4-class GPU gives about 10 times the capacity.
- **How to add it is the founder's decision (#109).** Either an always-on UK/EU GPU server, or a
  serverless GPU kept as a burst in front of the CPU. A serverless GPU must keep the CPU as its
  fallback, because waiting for capacity can take minutes. It should only take calls while it's
  warm, and its cold starts should happen in the background.

## Consequences

- `pnpm eval:load` (`apps/api/src/modules/ai/evals/load.ts`) measures any model server. Run it on
  the AI server (#32) under `--parallel`, and again before adding a GPU.
- **Not tested:** long Express generations and a real traffic mix. Repeat this on the AI server
  once Express has an eval set.
- The Modal setup used here is outside the repository (`~/.cache/figcit-ai/modal/`). If the
  founder approves Modal (#109), it moves into `docker/ai/` with the AI server (lane B).
