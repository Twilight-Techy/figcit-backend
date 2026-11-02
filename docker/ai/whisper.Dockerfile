# whisper-server for speech (ADR 0002): whisper.cpp v1.9.5 with every CPU variant built and the best
# one picked at start on x86 (a plain portable build lacks AVX2 and was 13x slower, ADR 0003).
FROM ubuntu:24.04 AS build
ARG WHISPER_CPP=v1.9.5
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git cmake g++ make \
  && rm -rf /var/lib/apt/lists/*
# x86: every CPU variant, picked at start. arm64: Ubuntu 24.04's GCC can't build the newest ARM
# variants, so build for the host's own CPU (the build host is the server).
RUN git clone -q --depth 1 --branch "$WHISPER_CPP" https://github.com/ggml-org/whisper.cpp /src \
  && cd /src \
  && if [ "$(uname -m)" = x86_64 ]; then cpu="-DGGML_NATIVE=OFF -DGGML_BACKEND_DL=ON -DGGML_CPU_ALL_VARIANTS=ON"; \
     else cpu="-DGGML_NATIVE=ON"; fi \
  && cmake -B build -DCMAKE_BUILD_TYPE=Release $cpu -DWHISPER_BUILD_TESTS=OFF \
  && cmake --build build -j"$(nproc)" --target whisper-server \
  && mkdir -p /opt/whisper && cp build/bin/whisper-server build/bin/*.so* /opt/whisper/

FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 ffmpeg \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /opt/whisper /opt/whisper
COPY whisper-entrypoint.sh /usr/local/bin/whisper-entrypoint
# --convert writes its temporary WAV to the working directory: /tmp is the only writable place.
WORKDIR /tmp
USER ubuntu
EXPOSE 8090
ENTRYPOINT ["whisper-entrypoint"]
