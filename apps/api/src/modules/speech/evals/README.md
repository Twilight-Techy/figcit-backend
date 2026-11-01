# Speech evals

Whisper small.en against Gemma 4 E4B's audio input on the same clips (SYSTEM_DESIGN §4.3.5,
§4.3.8; issue #65).

```bash
# Synthetic audio for every clip (needs Piper, its voices and ffmpeg)
PIPER=~/piper PIPER_VOICES=~/piper-voices pnpm eval:speech:generate --out var/speech-evals

WHISPER_URL=http://127.0.0.1:8090 pnpm eval:speech whisper --audio var/speech-evals
AI_BASE_URL=http://127.0.0.1:8088 AI_MODEL=gemma-4-e4b pnpm eval:speech gemma --audio var/speech-evals
```

- **whisper** calls whisper.cpp's `/inference` the way `SpeechService` does. Start the server as
  production will: `whisper-server -m ggml-small.en.bin -l en --vad --vad-model ggml-silero-v5.1.2.bin`.
- **gemma** sends the WAV to a llama.cpp server running Gemma 4 E4B with its `mmproj` (the audio
  encoder) and `--reasoning-budget 0`, through the chat API's `input_audio`.
- Results go to `var/speech-evals/results/` (not committed), as JSON and markdown, and each run is
  compared with the last one for the same model.

## What is measured

| Measure | Meaning |
| --- | --- |
| Word error rate | Substituted, missed and added words over all words said, after lower-casing and removing punctuation. Also split by room, accent and clips with a long pause |
| Invented text | A run of 3 or more words that were never said, or any words at all on a clip with no speech (the known Whisper failure on silence) |
| Latency p50 / p95 | Per clip. Memory is the server's, measured outside this script |

## The set

`set.json`: 50 clips.
- 40 sentences of the kind people say to the app: dumps, tasks, feelings, messages.
- Six voices: Scottish, Northern English, Southern English, RP, Midlands and US English.
- Half the clips are in a quiet room and half in a noisy one (pink noise about 18 dB below the
  speech).
- 8 clips have a 6-second pause in the middle.
- 10 clips have no speech: 5 quiet and 5 noisy, 10 seconds each.

**Version 1 is `synthetic`.** The issue asks for the team's own recordings, never users'. Until
they exist, `generate.ts` makes the audio with Piper's open voices (MIT code; voice licences on
the Piper voices page). Synthetic speech is cleaner and more regular than people, so the error
rates are lower bounds. To use real recordings, record each sentence as `<id>.wav` (16 kHz
mono), put them in one folder, set `status` to `recorded`, bump `version`, and pass the folder
as `--audio`.
