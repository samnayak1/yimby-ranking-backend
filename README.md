# yimby-ranking-backend



cd server
npx drizzle-kit generate
npx drizzle-kit migrate

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