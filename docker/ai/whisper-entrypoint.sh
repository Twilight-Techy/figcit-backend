#!/usr/bin/env bash
# Refuses model files whose SHA-256 differs, then serves English speech with voice-activity
# detection on, so silence never turns into invented text (SYSTEM_DESIGN §4.3.5).
set -euo pipefail
: "${WHISPER_MODEL:?}" "${WHISPER_SHA256:?}" "${VAD_MODEL:?}" "${VAD_SHA256:?}"
echo "$WHISPER_SHA256  $WHISPER_MODEL" | sha256sum -c - || { echo "whisper model hash mismatch" >&2; exit 1; }
echo "$VAD_SHA256  $VAD_MODEL" | sha256sum -c - || { echo "VAD model hash mismatch" >&2; exit 1; }
export LD_LIBRARY_PATH=/opt/whisper
exec /opt/whisper/whisper-server -m "$WHISPER_MODEL" --host 0.0.0.0 --port 8090 -l en \
  -t "${WHISPER_THREADS:-$(nproc)}" --vad --vad-model "$VAD_MODEL" --convert
