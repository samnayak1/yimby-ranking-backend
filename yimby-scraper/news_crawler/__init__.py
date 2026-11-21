"""Nightly crawler for housing / YIMBY news.

Reads the seeds in seeds.yaml, finds new articles, asks Gemini which ones are
about housing supply and what they mean, and writes them to the news_articles
table the backend serves on the "Scraped News Articles" tab.
"""
