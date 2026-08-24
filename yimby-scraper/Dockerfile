FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV DB_PATH=/app/db/database.sqlite
# forces Python to instantly output standard streams (stdout and stderr)
ENV PYTHONUNBUFFERED=1


RUN mkdir -p /app/data /data

ENTRYPOINT ["python", "main.py"]
