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

export default function PostsTable({ posts }: { posts: Post[] }) {
  const [sortField, setSortField] = useState<SortField>("postedAt");
  const [sortDir, setSortDir] = useState<SortDir>("default");

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir(nextDir(sortDir));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const groups = groupByDay(posts);

  return (
    <div className="space-y-8">
      {Array.from(groups.entries()).map(([day, dayPosts]) => {
        const sorted = sortPosts(dayPosts, sortField, sortDir);
        return (
          <section key={day}>
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {day}
              </h2>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {dayPosts.length} post{dayPosts.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-left text-zinc-500 dark:text-zinc-400">
                    <th className="px-4 py-2.5 font-medium w-[40%]">Title</th>
                    <th className="px-4 py-2.5 font-medium w-[30%]">Summary</th>
                    <th
                      className="px-4 py-2.5 font-medium cursor-pointer select-none whitespace-nowrap hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                      onClick={() => handleSort("postedAt")}
                    >
                      Posted{sortIndicator("postedAt", sortField, sortDir)}
                    </th>
                    <th
                      className="px-4 py-2.5 font-medium cursor-pointer select-none whitespace-nowrap hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors text-right"
                      onClick={() => handleSort("upvotes")}
                    >
                      Upvotes{sortIndicator("upvotes", sortField, sortDir)}
                    </th>
                    <th
                      className="px-4 py-2.5 font-medium cursor-pointer select-none whitespace-nowrap hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors text-right"
                      onClick={() => handleSort("numComments")}
                    >
                      Comments{sortIndicator("numComments", sortField, sortDir)}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {sorted.map((post) => (
                    <tr
                      key={post.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-900 dark:text-zinc-100 font-medium hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                        >
                          {post.title}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 line-clamp-2">
                        {post.summary}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {formatTime(post.postedAt)}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-right tabular-nums">
                        {post.upvotes}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-right tabular-nums">
                        {post.numComments}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
