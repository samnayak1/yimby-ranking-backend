"""
Scrapes r/yimby and returns raw posts.
No entity matching — discovery is handled by the LLM.
"""
import asyncpraw
from dataclasses import dataclass, field
from typing import Dict, List

from config import (
    REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT,
    SUBREDDIT, MAX_POSTS, MAX_COMMENTS,
)


@dataclass
class Post:
    title:    str
    body:     str
    score:    int
    url:      str
    flair:    str
    comments: List[str] = field(default_factory=list)

    def to_text(self) -> str:
        text = f"[score={self.score}] {self.title}\n{self.body}"
        if self.comments:
            text += "\nCOMMENTS:\n" + "\n".join(f"- {c}" for c in self.comments[:10])
        return text


@dataclass
class Post:
    title:    str
    body:     str
    score:    int
    url:      str
    flair:    str
    comments: List[str] = field(default_factory=list)

    def to_text(self) -> str:
        text = f"[score={self.score}] {self.title}\n{self.body}"
        if self.comments:
            text += "\nCOMMENTS:\n" + "\n".join(f"- {c}" for c in self.comments[:10])
        return text


async def fetch_posts(limit: int = MAX_POSTS) -> List[Post]:
    """Fetch top posts from r/yimby for the past year."""
    async with asyncpraw.Reddit(
        client_id=REDDIT_CLIENT_ID,
        client_secret=REDDIT_CLIENT_SECRET,
        user_agent=REDDIT_USER_AGENT,
    ) as reddit:
        subreddit = await reddit.subreddit(SUBREDDIT)
        posts = []

        print(f"Fetching up to {limit} posts from r/{SUBREDDIT}...")
        async for submission in subreddit.top(time_filter="year", limit=limit):
            # v8 change: load comments first, then replace_more
            await submission.load()
            try:
                await submission.comments.replace_more(limit=0)
                comment_list = submission.comments.list()
                comments = [
                    c.body for c in comment_list[:MAX_COMMENTS]
                    if hasattr(c, "body") and len(c.body) > 20
                ]
            except Exception:
                comments = []

            posts.append(Post(
                title=    submission.title,
                body=     submission.selftext[:2000],
                score=    submission.score,
                url=      submission.url,
                flair=    submission.link_flair_text or "",
                comments= comments,
            ))

        print(f"Fetched {len(posts)} posts.")
        return posts


def chunk_posts(posts: List[Post], chunk_size: int = 30) -> List[str]:
    """Split posts into chunks of text for the LLM discovery pass."""
    chunks = []
    for i in range(0, len(posts), chunk_size):
        batch = posts[i:i + chunk_size]
        text  = "\n\n---\n\n".join(p.to_text() for p in batch)
        chunks.append(text)
    return chunks


def posts_mentioning(posts: List[Post], name: str) -> List[Post]:
    """Filter posts that mention a given entity name."""
    name_lower = name.lower()
    last_name  = name.split()[-1].lower()
    return [
        p for p in posts
        if name_lower in (p.title + " " + p.body).lower()
        or last_name  in (p.title + " " + p.body).lower()
    ]


def bundle_for_entity(posts: List[Post], name: str, max_posts: int = 10) -> str:
    """Return a text block of posts relevant to a specific entity."""
    relevant = posts_mentioning(posts, name)[:max_posts]
    if not relevant:
        return ""
    return "\n\n---\n\n".join(p.to_text() for p in relevant)


def chunk_posts(posts: List[Post], chunk_size: int = 30) -> List[str]:
    """
    Split posts into chunks of text for the LLM discovery pass.
    Smaller chunks = more API calls but better extraction accuracy.
    """
    chunks = []
    for i in range(0, len(posts), chunk_size):
        batch = posts[i:i + chunk_size]
        text  = "\n\n---\n\n".join(p.to_text() for p in batch)
        chunks.append(text)
    return chunks


def posts_mentioning(posts: List[Post], name: str) -> List[Post]:
    """Filter posts that mention a given entity name."""
    name_lower = name.lower()
    last_name  = name.split()[-1].lower()
    return [
        p for p in posts
        if name_lower in (p.title + " " + p.body).lower()
        or last_name  in (p.title + " " + p.body).lower()
    ]


def bundle_for_entity(posts: List[Post], name: str, max_posts: int = 10) -> str:
    """Return a text block of posts relevant to a specific entity."""
    relevant = posts_mentioning(posts, name)[:max_posts]
    if not relevant:
        return ""
    return "\n\n---\n\n".join(p.to_text() for p in relevant)