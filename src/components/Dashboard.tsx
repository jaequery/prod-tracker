"use client";

import { useState } from "react";
import PostsTable from "./PostsTable";
import MonthlyChart from "./MonthlyChart";

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

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-");
  const d = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function deriveMonths(posts: Post[]): { key: string; label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of posts) {
    const key = getMonthKey(p.postedAt);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, count]) => ({ key, label: formatMonthLabel(key), count }));
}

export default function Dashboard({ posts }: { posts: Post[] }) {
  const months = deriveMonths(posts);
  const [selectedMonth, setSelectedMonth] = useState<string>(months[0]?.key ?? "");

  const filteredPosts = posts.filter((p) => getMonthKey(p.postedAt) === selectedMonth);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-10">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Show HN Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {posts.length} posts tracked
          </p>
        </header>

        <div className="flex gap-8">
          {/* Month sidebar */}
          <aside className="w-[220px] shrink-0">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
              Months
            </h2>
            <nav className="space-y-1">
              {months.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setSelectedMonth(m.key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                    m.key === selectedMonth
                      ? "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 font-medium"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span>{m.label}</span>
                    <span
                      className={`text-xs tabular-nums ${
                        m.key === selectedMonth
                          ? "text-orange-500 dark:text-orange-500"
                          : "text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      {m.count}
                    </span>
                  </span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            <MonthlyChart
              months={months}
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
            />
            {filteredPosts.length === 0 ? (
              <p className="text-zinc-500 dark:text-zinc-400">No posts for this month.</p>
            ) : (
              <PostsTable posts={filteredPosts} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
