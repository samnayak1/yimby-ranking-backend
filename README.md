# yimby-ranking-backend



cd server
npx drizzle-kit generate
npx drizzle-kit migrate

sqlite3 db/database.sqlite

PRAGMA index_list(cities);
PRAGMA index_list(politicians);

rm db/database.sqlite
rm -f db/database.sqlite-shm db/database.sqlite-wal


python3 --version
source venv/bin/activate
python main.py