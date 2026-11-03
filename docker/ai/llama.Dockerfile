# llama-server for the AI tasks (SYSTEM_DESIGN §4.3, ADR 0003/0004). CPU build of a pinned llama.cpp
# release, checked by SHA-256. The model file is mounted read-only and checked again at start.
FROM ubuntu:24.04
ARG LLAMA_CPP=b12020
ARG SHA_X64=1b69032f9ab60dc6aa909689fda941fa1b9162f6ab46b863582d5649d96ac6be
ARG SHA_ARM64=6cc95b52eb408b881df43242854a39a97f73cbaeb23337fef6cebe7a679b8125
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates libgomp1 \
  && rm -rf /var/lib/apt/lists/* \
  && case "$(uname -m)" in x86_64) a=x64; s=$SHA_X64 ;; aarch64) a=arm64; s=$SHA_ARM64 ;; *) exit 1 ;; esac \
  && curl -fsSL -o /tmp/llama.tgz "https://github.com/ggml-org/llama.cpp/releases/download/$LLAMA_CPP/llama-$LLAMA_CPP-bin-ubuntu-$a.tar.gz" \
  && echo "$s  /tmp/llama.tgz" | sha256sum -c - \
  && mkdir -p /opt/llama && tar xzf /tmp/llama.tgz -C /opt/llama --strip-components=1 && rm /tmp/llama.tgz
COPY llama-entrypoint.sh /usr/local/bin/llama-entrypoint
USER ubuntu
EXPOSE 8080
ENTRYPOINT ["llama-entrypoint"]
