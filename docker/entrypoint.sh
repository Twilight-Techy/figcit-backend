#!/bin/sh
# figcit api | worker | all — one image, two processes.
set -e
case "${1:-api}" in
  api) exec node dist/main.js ;;
  worker) exec node dist/worker.js ;;
  all)
    # For hosts with no separate worker (Render's free plan). If either process dies, exit so the
    # host restarts the instance.
    node dist/worker.js &
    worker=$!
    node dist/main.js &
    api=$!
    trap 'kill "$worker" "$api" 2>/dev/null' TERM INT
    while kill -0 "$worker" 2>/dev/null && kill -0 "$api" 2>/dev/null; do sleep 5; done
    kill "$worker" "$api" 2>/dev/null || true
    exit 1
    ;;
  *) exec "$@" ;;
esac
