FROM python:3.12-slim

WORKDIR /app

# Print log lines as they happen, so cron's log file isn't empty until exit.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY main.py seeds.yaml ./
COPY news_crawler ./news_crawler

# Same uid as the backend and Litestream, which own the shared SQLite volume.
USER 1000:1000

ENV DB_PATH=/app/db/database.sqlite

ENTRYPOINT ["python", "main.py"]
