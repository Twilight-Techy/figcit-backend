"""FigCit AI server on Modal (ADR 0009): Ministral 3 3B (llama.cpp) and Whisper small.en
(whisper.cpp) on CPUs in the EU, scaling to zero when idle.

    pip install modal==1.6.3 && modal token new                 # once
    modal secret create figcit-ai-prod AI_TOKEN=$(openssl rand -hex 32)
    modal run docker/ai/modal/figcit_ai.py::download            # fetch and check the models
    modal deploy docker/ai/modal/figcit_ai.py

Then, on the API: AI_BASE_URL=<language URL>, AI_TOKEN=<the token>,
AI_MODEL=ministral-3-3b-instruct-q4_k_m, WHISPER_URL=<speech URL>/t/<the token>.
"""

import hashlib
import os
import subprocess
import time
import urllib.request
from pathlib import Path

import modal

REGION = "eu"  # where the containers run: the European Economic Area (D-23)
# Where requests enter Modal. The default is us-east (Virginia) whatever REGION is; eu-west is
# Dublin. Fixed when a function is first deployed: changing it needs a new function. Requests or
# responses over 2 MiB still pass through Modal's us-east object storage (ADR 0009).
ROUTING_REGION = "eu-west"
# Idle time before a container stops. Longer means fewer cold starts and more idle cost.
IDLE_SECONDS = int(os.environ.get("FIGCIT_AI_IDLE_SECONDS", "600"))

LLAMA_CPP = "b12020"
LLAMA_SHA = "1b69032f9ab60dc6aa909689fda941fa1b9162f6ab46b863582d5649d96ac6be"
WHISPER_CPP = "v1.9.5"

MODELS = {
    "ministral": (
        "https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512-GGUF/resolve/eb599d408350ea2bb60452cb86be7c7b2fc28227/Ministral-3-3B-Instruct-2512-Q4_K_M.gguf",
        "9ed150d4367e68df0ac8e1540f6ddc65b42d0ee26378329d1ecbca60f93fc5f8",
    ),
    "whisper": (
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin",
        "c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d",
    ),
    "vad": (
        "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin",
        "29940d98d42b91fbd05ce489f3ecf7c72f0a42f027e4875919a28fb4c04ea2cf",
    ),
}
MODEL_DIR = Path("/models")

volume = modal.Volume.from_name("figcit-ai-prod-models", create_if_missing=True)
secret = modal.Secret.from_name("figcit-ai-prod")  # AI_TOKEN

image = (
    modal.Image.from_registry("ubuntu:24.04", add_python="3.12")
    .apt_install("curl", "ca-certificates", "libgomp1", "cmake", "g++", "git", "ffmpeg")
    .run_commands(
        f"curl -fsSL -o /tmp/llama.tgz https://github.com/ggml-org/llama.cpp/releases/download/{LLAMA_CPP}/llama-{LLAMA_CPP}-bin-ubuntu-x64.tar.gz",
        f"echo '{LLAMA_SHA}  /tmp/llama.tgz' | sha256sum -c -",
        "mkdir -p /opt/llama && tar xzf /tmp/llama.tgz -C /opt/llama --strip-components=1 && rm /tmp/llama.tgz",
        f"git clone -q --depth 1 --branch {WHISPER_CPP} https://github.com/ggml-org/whisper.cpp /opt/whisper.cpp",
        # Every CPU variant, the best picked at start: a plain portable build lacks AVX2 (ADR 0003).
        "cd /opt/whisper.cpp && cmake -B build -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=OFF"
        " -DGGML_BACKEND_DL=ON -DGGML_CPU_ALL_VARIANTS=ON -DWHISPER_BUILD_TESTS=OFF"
        " && cmake --build build -j8",
    )
    .pip_install("fastapi[standard]==0.115.12", "httpx==0.28.1")
)

app = modal.App("figcit-ai", image=image)


def path(name: str) -> Path:
    return MODEL_DIR / Path(MODELS[name][0]).name


@app.function(volumes={MODEL_DIR: volume}, timeout=3600, region=REGION)
def download() -> None:
    """Fetches each pinned model and refuses one whose SHA-256 differs (ENGINEERING_RULES §8)."""
    for name, (url, sha) in MODELS.items():
        target = path(name)
        if not target.exists():
            urllib.request.urlretrieve(url, target)
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        if digest != sha:
            target.unlink()
            raise RuntimeError(f"{name}: sha256 {digest} != {sha}")
        print(f"{name} ok")
    volume.commit()


common = dict(
    region=REGION,
    routing_region=ROUTING_REGION,
    volumes={MODEL_DIR: volume},
    secrets=[secret],
    min_containers=0,  # scale to zero
    scaledown_window=IDLE_SECONDS,
    max_containers=1,
    timeout=3600,
)


@app.function(cpu=8.0, memory=16384, **common)
@modal.concurrent(max_inputs=16)
@modal.web_server(8080, startup_timeout=300)
def language() -> None:
    """llama-server: 4 slots, token auth, --reasoning-budget 0 (ADR 0001, ADR 0003)."""
    subprocess.Popen(
        [
            "/opt/llama/llama-server", "-m", str(path("ministral")), "--host", "0.0.0.0",
            "--port", "8080", "-c", "16384", "--parallel", "4", "-t", "8", "--jinja",
            "--reasoning-budget", "0", "--api-key", os.environ["AI_TOKEN"], "--no-webui",
        ],
        env={**os.environ, "LD_LIBRARY_PATH": "/opt/llama"},
    )


@app.function(cpu=4.0, memory=4096, **common)
@modal.concurrent(max_inputs=8)
@modal.asgi_app()
def speech():
    """whisper-server has no auth of its own: it listens on localhost behind /t/<AI_TOKEN>/…"""
    import httpx
    from fastapi import FastAPI, HTTPException, Request, Response

    subprocess.Popen(
        [
            "/opt/whisper.cpp/build/bin/whisper-server", "-m", str(path("whisper")),
            "--host", "127.0.0.1", "--port", "8081", "-t", "4", "-l", "en",
            "--vad", "--vad-model", str(path("vad")), "--convert",
        ],
        cwd="/tmp",
    )
    for _ in range(120):
        try:
            httpx.get("http://127.0.0.1:8081/", timeout=1)
            break
        except httpx.HTTPError:
            time.sleep(1)

    web = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    client = httpx.AsyncClient(base_url="http://127.0.0.1:8081", timeout=600)

    @web.post("/t/{token}/{rest:path}")
    async def proxy(token: str, rest: str, request: Request) -> Response:
        if token != os.environ["AI_TOKEN"]:
            raise HTTPException(status_code=404)
        res = await client.post(
            f"/{rest}",
            content=await request.body(),
            headers={"content-type": request.headers.get("content-type", "")},
        )
        return Response(res.content, res.status_code, media_type=res.headers.get("content-type"))

    return web
