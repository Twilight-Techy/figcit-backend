# AI server

llama-server (language, Ministral 3 3B) and whisper-server (speech, Whisper small.en with VAD) on one
CPU host, reachable only over the private network (SYSTEM_DESIGN §4.3, §11; ADR 0002–0004).

## Host

- A UK/EU VPS with about 8 cores and 16 GB RAM. 32 GB leaves room for a second model. CPU only:
  ADR 0004 measured one 8-core server at about 12 AI calls a minute in time, and it scales with
  cores.
- **No public ports** other than SSH (key-only) and WireGuard (UDP).
- The app server and the AI server share a WireGuard network. The AI services bind only to the AI
  server's WireGuard address (`AI_BIND`).

### WireGuard

The examples use `10.8.0.0/24`, with the API at `10.8.0.1` and the AI server at `10.8.0.2`.

```ini
# AI server /etc/wireguard/wg0.conf
[Interface]
Address = 10.8.0.2/24
ListenPort = 51820
PrivateKey = <ai-server private key>

[Peer]            # the API server
PublicKey = <api-server public key>
AllowedIPs = 10.8.0.1/32
```

The API server's config is the mirror image: `Address = 10.8.0.1/24`, with a `[Peer]` that has the
AI server's public key, `Endpoint = <ai-server public IP>:51820`, `AllowedIPs = 10.8.0.2/32` and
`PersistentKeepalive = 25`.

Then run `systemctl enable --now wg-quick@wg0` on both. On the AI server, the firewall allows only
`51820/udp` and SSH from the internet, and ports 8080 and 8090 only from `10.8.0.1`.

## Run

```bash
cd docker/ai
./fetch-models.sh                      # pinned files, each checked by SHA-256
export AI_TOKEN=$(openssl rand -hex 32) AI_BIND=10.8.0.2
docker compose up -d --build
```

- **Model checks:** each container checks its model files' SHA-256 at start and refuses to run on a
  mismatch.
- **llama-server:** runs with 4 slots (`AI_PARALLEL`), the token (`AI_TOKEN`) and
  `--reasoning-budget 0`. It has `/health`, and `/metrics` for Prometheus.
- **whisper-server:** has no auth of its own, so it must stay on the private address. It converts
  uploads with ffmpeg (`--convert`).
- **Hardening:** both run read-only as a non-root user, with every Linux capability dropped.

## Connect the API

```bash
AI_BASE_URL=http://10.8.0.2:8080
AI_TOKEN=<same token>
AI_MODEL=ministral-3-3b-instruct-q4_k_m
WHISPER_URL=http://10.8.0.2:8090
```

## After deploying: measure

Run these from the API server. They use synthetic data only.

```bash
pnpm eval all          # accuracy and latency per task, against its timeout
pnpm eval:load         # how many calls the server handles in time (ADR 0004)
pnpm eval:speech whisper --audio <the speech set's audio>
```

Set each task's timeout to cover its p95 here. Watch `ai_calls` in production: add a GPU when calls
answered in time drop below 95% at peak (ADR 0004).
