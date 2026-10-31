#!/bin/sh
# figcit api | worker — one image, two processes.
set -e
case "${1:-api}" in
  api) exec node dist/main.js ;;
  worker) exec node dist/worker.js ;;
  *) exec "$@" ;;
esac
