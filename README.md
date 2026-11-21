Deployment (512MB Lightsail Instance, Amazon Linux 2023)
The server only has 512MB of RAM. That is enough to run the app, but not to build the Docker images.
Images are built on your own machine and shipped to the server with scripts/ship.sh. Never run a build on the server.



Bash
#install docker
sudo dnf install -y git docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

# dnf's docker package has no compose plugin; install it (buildx isn't needed, the server never builds)
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -fsSL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# No git checkout on the server. It only holds ~/yimby-ranking-backend/{docker-compose.yaml,
# litestream.yml,.env}. ship.sh copies the first two. .env is created once by hand (chmod 600)
# and is the source of truth: ship.sh also reads the VITE_* build values from it.
# Run dnf only AFTER setup-swap.sh: on 512MB, dnf gets OOM-killed without swap.

# To run localy
docker compose -f docker-compose.dev.yaml up --build



# Run this once per instance to add 2GB of swap space. At 512MB it is the
# runtime safety net against the OOM killer, not just a build aid.
./scripts/setup-swap.sh  

Red hat documentation if you want
https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/managing_storage_devices/getting-started-with-swap_managing-storage-devices


# Deploy: run this from YOUR machine with Docker running. "yimby" is a Host entry in ~/.ssh/config.
./scripts/ship.sh            # same as: ./scripts/ship.sh yimby

# Check memory on the server after a deploy
docker stats --no-stream && free -h

# scripts/deploy.sh (build on the server) only works on a 1GB+ instance.
Database and Backups
The app uses a SQLite database (database.sqlite). To prevent data loss if the server is destroyed, a tool called Litestream continuously backs up the database to an AWS S3 bucket.

Automatic Restore: If you restart or replace the server, Litestream automatically downloads the latest backup from S3 before the backend starts up.

Migrations: Database schema changes are applied automatically every time the backend container starts. You do not need to run manual migration commands in production.

To perform a manual point-in-time restore:
Stop the database, restore to a temporary file, and swap it in.

Bash
docker compose stop backend litestream
docker compose run --rm --entrypoint litestream litestream-restore \
  restore -config /etc/litestream.yml \
  -timestamp 2026-08-20T09:00:00Z \
  -o /app/db/restored.sqlite /app/db/database.sqlite
Web Server (HTTPS)
The app uses Caddy as its web server. Caddy automatically sets up HTTPS (SSL certificates) for you.

The env files contains SERVER ADRRESS yimby.example.com.

In the Lightsail console (Networking tab), make sure the IPv4 firewall allows TCP 80, TCP 443 and UDP 443 (HTTP/3). Only 22 and 80 are open by default. Attach a static IP, which is free while it is attached, and point the A records for SITE_ADDRESS and STATS_ADDRESS at it.



Migrating from EC2 to Lightsail
Litestream rebuilds the database from S3, so you don't need to copy it. Two rules matter:
- Never let both servers run Litestream at the same time. They would both write to the same S3 prefix.
- GoatCounter data is NOT in S3, so copy its volume by hand.

Bash
# 1. Lightsail: create the instance (same region as S3_BUCKET), do the setup
#    above, copy .env, run ./scripts/setup-swap.sh. Don't start anything yet.

# 2. EC2: stop writes, let Litestream ship the final WAL, then stop everything
docker compose stop backend goatcounter
sleep 360   # longer than LITESTREAM_SYNC_INTERVAL (5m)
docker compose down
docker run --rm -v yimby-ranking-backend_goatcounter_data:/data -v "$PWD":/backup \
  alpine tar czf /backup/goatcounter.tgz -C /data .
scp goatcounter.tgz ec2-user@<lightsail-ip>:~/yimby-ranking-backend/

# 3. Lightsail: restore GoatCounter, then start (Litestream restores the DB)
docker volume create yimby-ranking-backend_goatcounter_data
docker run --rm -v yimby-ranking-backend_goatcounter_data:/data -v "$PWD":/backup \
  alpine tar xzf /backup/goatcounter.tgz -C /data
# then, from your machine:
./scripts/ship.sh
# back on Lightsail:
docker compose logs litestream-restore   # should say it restored from S3

# 4. Point DNS at the Lightsail static IP. Caddy keeps retrying, and gets new
#    certificates once DNS resolves to the new server.
# 5. Once the new server checks out, terminate the EC2 instance and release its Elastic IP.



## News crawler

`yimby-scraper/` crawls housing news every night and fills the "Scraped News
Articles" tab. It reads the feeds and sitemaps in `yimby-scraper/seeds.yaml`,
asks Gemini (3.5 Flash-Lite) which articles are about housing supply and
whether each is a win or a loss, and writes them to the `news_articles` table.

- **Schedule:** midnight UTC, from a crontab entry `scripts/ship.sh` installs
  on the server. Output goes to `logs/news-crawler.log`.
- **Never starts over:** every link it has looked at is stored, each seed keeps
  a cursor and its feed's ETag in `news_sources`, and each run is logged with
  its token cost in `news_crawl_runs`.
- **Cost caps:** at most 100 articles read in full per run, and a monthly
  budget (`CRAWLER_MONTHLY_BUDGET_USD`, default $10) checked before every
  Gemini call.
- **Needs** `GEMINI_API_KEY` in `.env`.

```bash
# Production (what cron runs)
docker compose --profile jobs run --rm news-crawler

# Dev: classify without writing anything
docker compose -f docker-compose.dev.yaml --profile jobs run --rm news-crawler --dry-run --limit 5

# Locally, with yimby-scraper/.env
cd yimby-scraper && pip install -r requirements-dev.txt
python main.py --dry-run --seed "SF YIMBY" --limit 5
pytest
```
