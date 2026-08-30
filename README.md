# yimby-ranking-backend



npx drizzle-kit generate
npx drizzle-kit migrate

chmod +x src/jobs/backup.sh

sqlite3 db/database.sqlite
 .tables
 .schema

PRAGMA index_list(cities);
PRAGMA index_list(politicians);
sudo dnf install -y docker
 sudo systemctl enable --now docker
  sudo usermod -aG docker $USER 

sudo docker run hello-world

# Create the CLI plugins directory
mkdir -p ~/.docker/cli-plugins

# Download the Docker Compose plugin
COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" -o ~/.docker/cli-plugins/docker-compose

# Make it executable
chmod +x ~/.docker/cli-plugins/docker-compose

# Verify installation
docker compose version

 sudo usermod -aG docker ec2-user
  newgrp docker          # applies to current shell; or just log out and back in
  id -nG                 # confirm 'docker' is listed
  docker ps              # should work without sudo now


python3 --version
source venv/bin/activate
python main.py

python main.py                   # full pipeline
python main.py --stage scrape    # Reddit only, no LLM
python main.py --stage extract   # LLM only, no Reddit
python main.py --reextract       # redo LLM, skip Reddit
python main.py --only cities     # skip politicians


docker compose -f docker-compose.dev.yaml up --build


git --version
  git clone --recurse-submodules https://github.com/samnayak1/yimby-ranking-backend.git
  cd yimby-ranking-backend
  cp .env.example .env   # fill in
  docker compose up -d --build

  or 
   docker compose -f docker-compose.dev.yaml up --build



   ```bash
./scripts/setup-swap.sh   # once per instance: 2 GB swapfile, swappiness=10
./scripts/deploy.sh       # builds serially, then `up -d`
```
## Database durability

The SQLite DB lives in the `sqlite_data` Docker volume at `/app/db/database.sqlite`.
That volume sits on the EC2 instance's root EBS volume, which is destroyed when the
instance is **terminated** (stopping is safe). Litestream guards against this by
streaming the WAL to S3 continuously.

- `litestream.yml` — replica config; reads `S3_BUCKET`, `AWS_REGION`,
  `LITESTREAM_S3_PREFIX` and the AWS creds from `.env`.
- `litestream-restore` — init container. Runs to completion before `backend` starts.
  Restores from S3 only when `/app/db/database.sqlite` is absent, so restarts are safe.
- `litestream` — sidecar that replicates continuously (sub-second lag).

Bringing up a replacement instance needs no manual step: `docker compose up -d`
restores the DB, then starts the backend.

### Verify replication

```bash
docker compose logs -f litestream          # should log periodic syncs
docker compose exec litestream litestream snapshots /app/db/database.sqlite
```

### Point-in-time restore

Stop writers first, then restore to a scratch path and swap it in:

```bash
docker compose stop backend litestream
docker compose run --rm --entrypoint litestream litestream-restore \
  restore -config /etc/litestream.yml \
  -timestamp 2026-08-20T09:00:00Z \
  -o /app/db/restored.sqlite /app/db/database.sqlite
```

Then swap `restored.sqlite` over `database.sqlite` (deleting the stale `-wal`/`-shm`
files) and `docker compose up -d`.

> **Single writer only.** Litestream replicates one direction. Never run two hosts
> writing to the same replica path, and note that `yimby-scraper` writes to this same
> file — it must run on the same host.

### Dev

`docker-compose.dev.yaml` has the same pair, replicating the `sqlite_data_dev`
volume to `LITESTREAM_DEV_S3_PREFIX` (default `yimby-dev/database.sqlite`). Keep
that prefix distinct from `LITESTREAM_S3_PREFIX` — sharing one would let dev
overwrite the production replica.

The dev services use the same service names as production. Don't run both compose
files under one project name; pass `-p` if you ever need them side by side.

### Tuning replication frequency

`LITESTREAM_SYNC_INTERVAL` (default `1m`) controls how often WAL frames ship to
S3. It is your RPO: on instance loss you lose at most that much work. Litestream
only issues S3 writes when the WAL has actually changed, so an idle database costs
nothing no matter how low the interval is — raising it batches *bursts* of writes,
it does not eliminate steady-state cost.

`snapshot-interval` (6h) and `retention` (720h) are set in `litestream.yml` and are
independent of this.

## Running on a 1 GiB instance (t3a.micro / t3.micro)

Runtime fits comfortably; **image builds are what run out of memory**. Two steps:

```bash
./scripts/setup-swap.sh   # once per instance: 2 GB swapfile, swappiness=10
./scripts/deploy.sh       # builds serially, then `up -d`
```

`scripts/deploy.sh` exists because `docker compose build` parallelises by default,
which starts two `npm ci` runs and two TypeScript/Vite builds simultaneously — the
usual cause of an OOM-killed deploy on this instance size.

Both Dockerfiles set `NODE_OPTIONS=--max-old-space-size=512` for the build step so
V8 garbage-collects rather than growing into swap-thrash.

`mem_limit` on each service caps runtime usage (backend 384m, nginx 64m,
litestream 64m) so no single container can OOM-kill the others.

## Web server: Caddy

The client image (`yimby-ranking-client/Dockerfile`) builds the SPA and serves it
with Caddy, configured by `yimby-ranking-client/Caddyfile`. `nginx/nginx.prod.conf`
is no longer used by `docker-compose.yaml` (the dev compose still uses
`nginx/nginx.dev.conf`).

### HTTPS

`SITE_ADDRESS` in `.env` drives it:

| Value | Behaviour |
|---|---|
| unset / blank | plain HTTP on `:80` — fine before you have a domain |
| `yimby.example.com` | Caddy obtains a Let's Encrypt cert and redirects HTTP to HTTPS |

Requirements for the domain case:
- the domain must already resolve to the instance's public IP
- security group must allow **both** 80 and 443 inbound (80 is required for the
  ACME challenge and the redirect, not just 443)

Certificates persist in the `caddy_data` volume. Do not `docker compose down -v`
casually — re-requesting certs repeatedly hits Let's Encrypt's limit of 5
duplicate certificates per week.

## Running the scraper

The scraper is **dev-only** — it is not part of the production compose file. It
is a one-shot ETL behind a profile, so `up` never starts it:

```bash
docker compose -f docker-compose.dev.yaml --profile scraper run --rm scraper
docker compose -f docker-compose.dev.yaml --profile scraper run --rm scraper --only cities
docker compose -f docker-compose.dev.yaml --profile scraper run --rm scraper --reextract
```

It mounts `sqlite_data_dev`, so it writes the database the dev backend reads.
Source is bind-mounted, so edits take effect without a rebuild. Reads
`REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` and `OPENAI_API_KEY` from
`yimby-scraper/.env`.

Do not run `python main.py` from the venv: `config.py` defaults `DB_PATH` to the
host `./db/database.sqlite`, which is neither the dev volume nor production.

Because the scraper never runs in production, scraped rows reach prod only if you
promote the dev database deliberately, or re-enter the data through the admin UI.


## Applying schema changes

Migrations in `drizzle/` are applied by `runMigrations()` at backend startup
(`src/server.ts`), so **restarting the backend is the migration step**. There is
no separate command to run in Docker.

```bash
# dev
docker compose -f docker-compose.dev.yaml up -d --build backend

# prod
docker compose up -d --build backend
```

Verify a column landed:

```bash
docker compose exec backend node -e \
  "const d=require('better-sqlite3')('db/database.sqlite');
   console.log(d.prepare('PRAGMA table_info(city_ratings)').all().map(c=>c.name).join(', '))"
```

`npm run db:migrate` also works, but `drizzle.config.ts` points at the **host**
`./db/database.sqlite` — a different file from the one in the Docker volume. Use
it only when running the backend outside Docker.
