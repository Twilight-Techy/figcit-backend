# 0009: The AI server runs on Modal, in the EU, scaling to zero

**Status:** Accepted, 3 November 2026, by Twilight-Techy (authorised to decide every item). Issue #121.
Reverses D-40's "no serverless GPU for production" for the **CPU** AI server. The models stay the same
(ADR 0002, ADR 0003, ADR 0006).

## Context

While users are few, an always-on AI server (ADR 0004) costs money for nothing. Running it on the app
server was considered and dropped (#120). Modal runs containers only while they're used and can keep
them in the EU.

## Decision

- **The AI server is the Modal app in `docker/ai/modal/figcit_ai.py`:**
  - **Language:** llama-server with Ministral 3 3B on 8 CPUs and 16 GB, 4 slots.
  - **Speech:** whisper-server with Whisper small.en on 4 CPUs and 4 GB, with VAD.
  - Same pinned builds (llama.cpp `b12020`, whisper.cpp v1.9.5) and models, checked by SHA-256 when
    downloaded.
- **Scale to zero:** `min_containers=0`. A container stops after 10 minutes idle
  (`FIGCIT_AI_IDLE_SECONDS`). At most one container per function.
- **In the EU, end to end:**
  - containers run in `region="eu"` (the European Economic Area);
  - requests enter through `routing_region="eu-west"` (Dublin) instead of Modal's default Virginia
    proxy.

  The routing region can only be set when a function is first deployed.
- **Auth:**
  - llama-server takes the token (`--api-key`);
  - whisper-server, which has no auth, sits behind a `/t/<token>/` path.

  The token is the Modal secret `figcit-ai-prod`.
- **CPU, not GPU.** Ministral meets every timeout on 8 CPUs (ADR 0006). A cold GPU once waited
  796 s for capacity (ADR 0004).
- **Unchanged:** the API's own settings (`AI_BASE_URL`, `AI_TOKEN`, `AI_MODEL`, `WHISPER_URL`). The
  Docker files in `docker/ai/` stay for self-hosting later.

## Measured

On Modal in the EU, with synthetic data:

| | Result |
| --- | --- |
| Cold start (from zero to the first answer) | 9.2 s, 32.6 s, 13.6 s |
| Warm decision call | about 0.4 s (suggestDrivers 80%, mapFeeling 85% on 20 cases each) |
| Warm parseNeed | 85% on 20 cases, p50 5.1 s, 95% inside 8 s |
| Whisper, one clip | about 3.6 s including the upload |

## Consequences

- **Cold starts fall back.** The first AI call after 10 idle minutes reaches a container that is
  still loading: llama-server answers 503, or the call outlasts its 4 to 8 s timeout. The user gets
  the rule fallback for that call, and the following calls get the AI. Every feature already has a
  fallback, so nothing breaks; the cost is a worse first answer after a quiet spell. If that
  matters, the API could send a warm-up request when a check-in starts.
- **Large requests pass through the US.** Modal keeps requests and responses over 2 MiB in its
  us-east object storage, whatever the routing region. Text calls are a few KB. A long voice
  recording can exceed 2 MiB: a 10-minute recording at 64 kbps is about 4.8 MB.

  **Before real users,** keep speech uploads under 2 MiB, either by splitting long recordings in the
  worker or by recording at a lower bitrate.
- **Modal becomes a processor of user text and audio. Before real users:**
  - a data processing agreement with Modal;
  - Modal on the list of sub-processors;
  - the privacy notice updated: AI and speech run on our own models, on Modal's servers in the EU,
    and are never used for training (D-23).
- **Cost:** pay per second while a container runs, plus the EU region multipliers (1.15× for
  `eu`). Nothing while idle.
- **Moving back:** to an always-on server (ADR 0004), change the four API settings. To a GPU, change
  the function's `cpu` to a `gpu` and re-run the evals.
