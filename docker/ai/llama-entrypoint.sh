#!/usr/bin/env bash
# Refuses a model file whose SHA-256 differs from MODEL_SHA256 (ENGINEERING_RULES §8), then serves it.
set -euo pipefail
: "${MODEL_FILE:?}" "${MODEL_SHA256:?}" "${AI_TOKEN:?}"
echo "checking $MODEL_FILE"
echo "$MODEL_SHA256  $MODEL_FILE" | sha256sum -c - || { echo "model file hash mismatch: refusing to start" >&2; exit 1; }
PARALLEL="${AI_PARALLEL:-4}"
export LD_LIBRARY_PATH=/opt/llama
# --reasoning-budget 0: no model may spend max_tokens thinking (ADR 0001). The fixed system prompts
# stay cached between calls per slot.
exec /opt/llama/llama-server -m "$MODEL_FILE" --host 0.0.0.0 --port 8080 \
  -c $((4096 * PARALLEL)) --parallel "$PARALLEL" -t "${AI_THREADS:-$(nproc)}" \
  --jinja --reasoning-budget 0 --api-key "$AI_TOKEN" --metrics --no-webui
