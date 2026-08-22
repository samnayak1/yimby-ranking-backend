#!/usr/bin/env bash
# Build + deploy on a 1 GiB instance.
#
# `docker compose build` builds services in PARALLEL by default, which on this
# box means two `npm ci` + two TypeScript/Vite builds at once — the usual cause
# of an OOM-killed deploy. Build one at a time instead.
set -euo pipefail
cd "$(dirname "$0")/.."

swapon --show | grep -q . || {
  echo "No swap active. Run scripts/setup-swap.sh first." >&2; exit 1; }

echo "==> Building backend"
docker compose build backend

echo "==> Building client (tsc + vite; the memory-hungry one)"
docker compose build nginx

echo "==> Starting"
docker compose up -d

echo "==> Reclaiming build layer space"
docker image prune -f

docker compose ps
