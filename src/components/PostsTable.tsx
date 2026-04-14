"use client";

import { useState } from "react";

type Post = {
  id: number;
  hnId: string;
  title: string;
  summary: string;
  url: string;
  numComments: number;
  upvotes: number;
  postedAt: string;
  createdAt: string;
};

type SortField = "postedAt" | "upvotes" | "numComments";
type SortDir = "default" | "asc" | "desc";

function nextDir(dir: SortDir): SortDir {
  if (dir === "default") return "asc";
  if (dir === "asc") return "desc";
  return "default";
}

function sortIndicator(field: SortField, activeField: SortField, dir: SortDir) {
  if (field !== activeField || dir === "default") return "";
  return dir === "asc" ? " ↑" : " ↓";
}

function groupByDay(posts: Post[]): Map<string, Post[]> {
  const groups = new Map<string, Post[]>();
  for (const post of posts) {
    const day = new Date(post.postedAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(post);
  }
  return groups;
}

function sortPosts(posts: Post[], field: SortField, dir: SortDir): Post[] {
  if (dir === "default") {
    return [...posts].sort(
      (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
    );
  }
  const mult = dir === "asc" ? 1 : -1;
  return [...posts].sort((a, b) => {
    if (field === "postedAt") {
      return mult * (new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime());
    }
    return mult * ((a[field] as number) - (b[field] as number));
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function getHostname(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    if (hostname.includes("news.ycombinator.com")) return null;
    return hostname;
  } catch {
    return null;
  }
}

export default function PostsTable({ posts }: { posts: Post[] }) {
  const [sortField, setSortField] = useState<SortField>("upvotes");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir(nextDir(sortDir));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const groups = groupByDay(posts);

  const sortButtonClass =
    "px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer select-none transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800";

  return (
    <div className="space-y-8">
      {Array.from(groups.entries()).map(([day, dayPosts]) => {
        const sorted = sortPosts(dayPosts, sortField, sortDir);
        const isExpanded = expandedDays.has(day);
        const limit = 10;
        const visiblePosts = isExpanded ? sorted : sorted.slice(0, limit);
        const hiddenCount = sorted.length - limit;

        function toggleDay() {
          setExpandedDays((prev) => {
            const next = new Set(prev);
            if (next.has(day)) next.delete(day);
            else next.add(day);
            return next;
          });
        }

        return (
          <section key={day}>
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {day}
                </h2>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {dayPosts.length} post{dayPosts.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-400 dark:text-zinc-500 mr-1">Sort:</span>
                <button
                  onClick={() => handleSort("upvotes")}
                  className={sortButtonClass}
                >
                  Upvotes{sortIndicator("upvotes", sortField, sortDir)}
                </button>
                <button
                  onClick={() => handleSort("numComments")}
                  className={sortButtonClass}
                >
                  Comments{sortIndicator("numComments", sortField, sortDir)}
                </button>
                <button
                  onClick={() => handleSort("postedAt")}
                  className={sortButtonClass}
                >
                  Posted{sortIndicator("postedAt", sortField, sortDir)}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {visiblePosts.map((post) => {
                const hostname = getHostname(post.url);
                const hnLink = `https://news.ycombinator.com/item?id=${post.hnId}`;

                return (
                  <div
                    key={post.id}
                    className="group rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-900/50 px-4 py-3 transition-colors hover:border-zinc-300 dark:hover:border-zinc-600"
                  >
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      {/* Left: title, project link, summary */}
                      <div className="min-w-0 flex-1">
                        <a
                          href={hnLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                        >
                          {post.title}
                        </a>
                        {hostname && (
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                          >
                            ({hostname})
                          </a>
                        )}
                        {post.summary && (
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                            {post.summary}
                          </p>
                        )}
                      </div>

                      {/* Right: stats */}
                      <div className="flex items-center gap-3 text-xs tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0">
                        <span title="Upvotes">▲ {post.upvotes}</span>
                        <span className="text-zinc-300 dark:text-zinc-600">|</span>
                        <span title="Comments">💬 {post.numComments}</span>
                        <span className="text-zinc-300 dark:text-zinc-600">|</span>
                        <span title="Posted at">{formatTime(post.postedAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {hiddenCount > 0 && (
              <button
                onClick={toggleDay}
                className="mt-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
              >
                {isExpanded ? "Show less" : `Show ${hiddenCount} more`}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
