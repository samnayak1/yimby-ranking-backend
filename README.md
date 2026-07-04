# yimby-ranking-backend



cd server
npx drizzle-kit generate
npx drizzle-kit migrate

sqlite3 db/database.sqlite

rm db/database.sqlite
rm -f db/database.sqlite-shm db/database.sqlite-wal