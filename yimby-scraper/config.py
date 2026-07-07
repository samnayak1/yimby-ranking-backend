import os
from anyio import Path
from pathlib import Path
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()

# ── Reddit ────────────────────────────────────────────────────
REDDIT_CLIENT_ID     = os.environ["REDDIT_CLIENT_ID"]
REDDIT_CLIENT_SECRET = os.environ["REDDIT_CLIENT_SECRET"]
REDDIT_USER_AGENT    = os.getenv("REDDIT_USER_AGENT", "yimby-scraper/1.0")
SUBREDDIT            = "yimby"


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("DB_PATH", str(BASE_DIR.parent / "db" / "database.sqlite")))





load_dotenv()

llm = ChatOpenAI(
    model="gpt-4o-mini",
    api_key=os.environ["OPENAI_API_KEY"],
    temperature=0.2,
    max_tokens=2000,
)

# ── Scraping limits ───────────────────────────────────────────
MAX_POSTS      = 500   # posts to scan from r/yimby
MAX_COMMENTS   = 40    # comments per post to include in summary
YEARS_BACK     = 5     # years of rating history to generate

# ── Supported regions ─────────────────────────────────────────
EU_COUNTRIES = {
    "Germany", "France", "Netherlands", "Sweden", "Norway", "Denmark",
    "Finland", "Spain", "Italy", "Portugal", "Belgium", "Austria",
    "Switzerland", "Poland", "Czech Republic", "Ireland", "United Kingdom",
}