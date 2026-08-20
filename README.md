# yimby-ranking-backend



cd server
npx drizzle-kit generate
npx drizzle-kit migrate

chmod +x src/jobs/backup.sh

sqlite3 db/database.sqlite
 .tables
 .schema

PRAGMA index_list(cities);
PRAGMA index_list(politicians);



python3 --version
source venv/bin/activate
python main.py

python main.py                   # full pipeline
python main.py --stage scrape    # Reddit only, no LLM
python main.py --stage extract   # LLM only, no Reddit
python main.py --reextract       # redo LLM, skip Reddit
python main.py --only cities     # skip politicians


docker compose -f docker-compose.dev.yaml up --build



  git clone --recurse-submodules https://github.com/samnayak1/yimby-ranking-backend.git
  cd yimby-ranking-backend
  cp .env.example .env   # fill in
  docker compose up -d --build

  or 
   docker compose -f docker-compose.dev.yaml up --build
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
