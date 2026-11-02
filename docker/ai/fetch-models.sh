#!/usr/bin/env bash
# Downloads the pinned model files into ./models and checks each one (ADR 0002, ADR 0003).
set -euo pipefail
cd "$(dirname "$0")" && mkdir -p models && cd models
get() { # url file sha256
  [ -f "$2" ] || curl -fL --retry 3 -o "$2" "$1"
  echo "$3  $2" | sha256sum -c -
}
get https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512-GGUF/resolve/eb599d408350ea2bb60452cb86be7c7b2fc28227/Ministral-3-3B-Instruct-2512-Q4_K_M.gguf \
  Ministral-3-3B-Instruct-2512-Q4_K_M.gguf 9ed150d4367e68df0ac8e1540f6ddc65b42d0ee26378329d1ecbca60f93fc5f8
get https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin \
  ggml-small.en.bin c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d
get https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin \
  ggml-silero-v5.1.2.bin 29940d98d42b91fbd05ce489f3ecf7c72f0a42f027e4875919a28fb4c04ea2cf
