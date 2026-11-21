#!/usr/bin/env bash
# Build images on this machine and ship them to the server.
#
# The 512 MB Lightsail box can't build the images itself (tsc + vite need more
# RAM than it has, even with swap), so it only ever loads finished images and
# runs them. It has no git checkout: the only files it needs are
# docker-compose.yaml, litestream.yml and .env, and this script copies the first
# two. The server's .env is the source of truth and is never overwritten.
#
# Usage: scripts/ship.sh [ssh-host] [remote-dir]   (defaults: yimby, yimby-ranking-backend)
set -euo pipefail
cd "$(dirname "$0")/.."

HOST=${1:-yimby}
REMOTE_DIR=${2:-yimby-ranking-backend}
IMAGES=(yimby-backend:latest yimby-caddy:latest yimby-news-crawler:latest)

echo "==> Reading build-time VITE_* values from $HOST:.env"
# Exported vars take precedence over the local .env during compose interpolation,
# so the client bundle is built with production Cognito ids.
while IFS= read -r line; do
  export "$line"
done < <(ssh "$HOST" "grep -E '^VITE_[A-Z_]+=' $REMOTE_DIR/.env")
: "${VITE_COGNITO_USER_POOL_ID:?missing on server}" "${VITE_COGNITO_CLIENT_ID:?missing on server}"

echo "==> Building locally"
git submodule update --init
docker compose build backend caddy
docker compose --profile jobs build news-crawler

echo "==> Shipping images to $HOST"
docker save "${IMAGES[@]}" | gzip | ssh "$HOST" 'gunzip | docker load'

echo "==> Copying config and restarting on $HOST"
scp -q docker-compose.yaml litestream.yml "$HOST:$REMOTE_DIR/"
ssh "$HOST" "set -e
  cd $REMOTE_DIR
  mkdir -p logs/caddy
  docker compose up -d --no-build
  docker image prune -f
  docker compose ps

  # Nightly news crawler at midnight server time (UTC on Lightsail). The tag
  # comment makes this idempotent: the old line is replaced, never duplicated.
  ( crontab -l 2>/dev/null | grep -v '# yimby-news-crawler$' || true
    echo '0 0 * * * cd \$HOME/$REMOTE_DIR && docker compose --profile jobs run --rm news-crawler >> logs/news-crawler.log 2>&1 # yimby-news-crawler'
  ) | crontab -
  echo 'Crawler cron:' && crontab -l | grep 'yimby-news-crawler$'"
