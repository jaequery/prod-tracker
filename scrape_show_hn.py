#!/usr/bin/env python3
"""Scrape Hacker News 'Show HN' posts via Algolia API and output to CSV."""

import argparse
import csv
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone

import requests

API_URL = "http://hn.algolia.com/api/v1/search_by_date"


def fetch_show_hn(days: int) -> list[dict]:
    """Fetch all Show HN posts from the last N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_ts = int(cutoff.timestamp())

    posts = []
    page = 0

    while True:
        params = {
            "tags": "show_hn",
            "hitsPerPage": 100,
            "page": page,
            "numericFilters": f"created_at_i>{cutoff_ts}",
        }
        resp = requests.get(API_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        hits = data.get("hits", [])
        if not hits:
            break

        for hit in hits:
            title = hit.get("title", "")
            summary = title.split("Show HN: ", 1)[-1] if "Show HN:" in title else title
            created = hit.get("created_at", "")
            date_str = created[:10] if created else ""
            url = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}"
            num_comments = hit.get("num_comments", 0)
            upvotes = hit.get("points", 0)

            posts.append({
                "date": date_str,
                "title": title,
                "summary": summary,
                "url": url,
                "num_comments": num_comments,
                "upvotes": upvotes,
            })

        if page >= data.get("nbPages", 0) - 1:
            break
        page += 1

    return posts


def write_csv(posts: list[dict], filename: str) -> None:
    """Write posts to CSV."""
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["date", "title", "summary", "url", "num_comments", "upvotes"])
        writer.writeheader()
        writer.writerows(posts)


def print_daily_summary(posts: list[dict]) -> None:
    """Print count of posts per day."""
    counts = Counter(p["date"] for p in posts)
    print("\n=== Daily Summary ===")
    for date in sorted(counts):
        print(f"  {date}: {counts[date]} posts")
    print(f"\nTotal: {len(posts)} posts")


def main():
    parser = argparse.ArgumentParser(description="Scrape Show HN posts from Hacker News")
    parser.add_argument("--days", type=int, default=7, help="Number of days to look back (default: 7)")
    args = parser.parse_args()

    print(f"Fetching Show HN posts from the last {args.days} day(s)...")
    posts = fetch_show_hn(args.days)

    if not posts:
        print("No posts found.")
        sys.exit(0)

    output_file = "show_hn_posts.csv"
    write_csv(posts, output_file)
    print(f"Wrote {len(posts)} posts to {output_file}")
    print_daily_summary(posts)


if __name__ == "__main__":
    main()
