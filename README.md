Deployment (1GB EC2 Instance)
The server only has 1GB of RAM, building the Docker images can cause it to run out of memory and crash. To prevent this, use the provided scripts to set up swap space and build the containers one at a time.



Bash
# To run localy
docker compose -f docker-compose.dev.yaml up --build



# Run this once per instance to add 2GB of swap space
./scripts/setup-swap.sh  

Red hat documentation if you want
https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/managing_storage_devices/getting-started-with-swap_managing-storage-devices


# Run this to build and deploy the app safely
./scripts/deploy.sh      
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

Ensure your server's security group allows traffic on both port 80 and 443.



Running the Scraper
The Python scraper is for development only and is not included in the main production deployment. It writes directly to your local development database.

Run the scraper using the scraper Docker profile:

Bash
# Run the full pipeline
docker compose -f docker-compose.dev.yaml --profile scraper run --rm scraper

# Run only specific stages
docker compose -f docker-compose.dev.yaml --profile scraper run --rm scraper --only cities
docker compose -f docker-compose.dev.yaml --profile scraper run --rm scraper --reextract
