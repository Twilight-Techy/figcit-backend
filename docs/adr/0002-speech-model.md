# 0002: Speech model

**Status:** Accepted, 1 November 2026, by Twilight-Techy (tech lead; D-38's owner). Issue #65. To
be checked again on the team's own recordings.

## Context

SYSTEM_DESIGN §4.3.5 uses Whisper small.en on whisper.cpp. Gemma 4 E4B is the candidate to
replace it: if it transcribes as accurately and invents no text on silence, one model covers
language and voice. The speech eval (`apps/api/src/modules/speech/evals/`) compares the two on the
same 50 clips.

The clips are **synthetic** (set version 1). Issue #65 asks for the team's own recordings, which
don't exist yet. The audio was made with Piper's open voices:
- six accents: Scottish, Northern English, Southern English, RP, Midlands and US;
- 40 sentences, half in a quiet room and half in a noisy one;
- 8 with a 6-second pause mid-sentence;
- 10 with no speech at all.

Synthetic speech is cleaner than people, so both error rates are lower bounds. Both models ran on
the same 2-core ARM development machine:
- Whisper: `whisper-server` v1.9.5, `ggml-small.en`, `-l en --vad`, Silero VAD v5.1.2.
- Gemma: llama.cpp `b12020`, Gemma 4 E4B Q4_K_M with its F16 `mmproj` (audio encoder) and the
  no-thinking template from ADR 0001.

## Results

| Measure | Whisper small.en | Gemma 4 E4B |
| --- | --- | --- |
| Word error rate | **2.3%** | 3.6% |
| WER, quiet / noisy room | 4.2% / 0.4% | 3.3% / 3.8% |
| WER, long pause mid-sentence | 5.4% | 3.2% |
| Clips with invented text | **0** | 10 (all 10 clips with no speech) |
| Latency p50 / p95 per clip | **10.7 s / 11.1 s** | 31.2 s / 56.0 s |
| Peak server memory | **0.7 GB** | 6.5 GB (language model included) |

- Two of Whisper's 13 word errors are US spellings ("practice", "color"), not mishearings.
- On no-speech clips, Gemma answered "I'm sorry, but I cannot transcribe the audio because no
  audio was provided" 9 times, and invented "The quick brown fox jumps over the lazy dog" once.
- Without a JSON schema, Gemma also wrapped every transcript in commentary ("The user wants me
  to transcribe…"). The run above asks for `{ "transcript": … }`, as every other AI task does.
- llama.cpp labels its audio input experimental.

## Decision

**Whisper small.en stays the speech model.** Gemma 4 E4B fails both conditions for replacing it.
It is less accurate. It also writes text when nobody spoke, which is the failure §4.3.5 exists to
prevent. The AI server keeps two models: Qwen3.5-4B for language (ADR 0001) and Whisper small.en
for speech.

## Consequences

- whisper.cpp runs with `-l en --vad --vad-model ggml-silero-v5.1.2.bin`. VAD is why Whisper
  wrote nothing on silence.
- Re-run the eval when the team records the set, to replace the synthetic audio. Look again at
  Gemma (or another model with audio input) only if a later version clearly beats these numbers.
