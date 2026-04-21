"use client";

import { useState } from "react";
import PostsTable from "./PostsTable";

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
  aiSummary: string | null;
  aiScore: number | null;
  aiScoreDetails: unknown;
  previewImage: string | null;
  siteDescription: string | null;
};

type Rating = { postId: number; value: number; reason: string | null };

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-");
  const d = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "UTC" });
}

function formatShortMonth(key: string): string {
  const [year, month] = key.split("-");
  const d = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
  return d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

function deriveMonths(posts: Post[]) {
  const map = new Map<string, number>();
  for (const p of posts) {
    const key = getMonthKey(p.postedAt);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, count]) => ({ key, label: formatMonthLabel(key), short: formatShortMonth(key), count }));
}

function computeStats(posts: Post[]) {
  const scored = posts.filter((p) => p.aiScore != null);
  const fresh = scored.filter((p) => p.aiScore! >= 70).length;
  const rotten = scored.filter((p) => p.aiScore! < 40).length;
  const avg = scored.length > 0 ? Math.round(scored.reduce((s, p) => s + p.aiScore!, 0) / scored.length) : 0;
  return { total: posts.length, scored: scored.length, fresh, rotten, avg };
}

export default function Dashboard({
  posts,
  ratings,
}: {
  posts: Post[];
  ratings: Rating[];
}) {
  const months = deriveMonths(posts);
  const [selectedMonth, setSelectedMonth] = useState<string>(months[0]?.key ?? "");

  const filteredPosts = posts.filter((p) => getMonthKey(p.postedAt) === selectedMonth);
  const currentMonth = months.find((m) => m.key === selectedMonth);
  const stats = computeStats(filteredPosts);

  return (
    <div className="max-w-[900px] mx-auto px-6 py-20">
      {/* Header */}
      <header className="mb-16">
        <div className="flex items-center gap-4 mb-2">
          <span className="text-6xl">🍅</span>
          <h1 className="text-7xl font-800 tracking-tighter leading-none">Show HN</h1>
        </div>
        <p className="text-xl text-neutral-500 font-400 mt-4">
          AI critic reviews for Show HN projects
        </p>
      </header>

      {/* Month pills */}
      <div className="flex items-center gap-3 mb-14 flex-wrap">
        {months.map((m) => (
          <button
            key={m.key}
            onClick={() => setSelectedMonth(m.key)}
            className={`px-5 py-2.5 rounded-full text-base font-600 transition-all cursor-pointer ${
              m.key === selectedMonth
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
            }`}
          >
            {m.short}
            <span className="ml-2 font-mono text-sm opacity-50">{m.count}</span>
          </button>
        ))}
      </div>

      {/* Month title + stats */}
      <div className="mb-12">
        <h2 className="text-4xl font-800 tracking-tight mb-5">{currentMonth?.label}</h2>
        <div className="flex items-center gap-8 text-lg">
          <span className="text-neutral-400">{stats.total} projects</span>
          <span className="flex items-center gap-2">
            <span className="text-2xl">🍅</span>
            <span className="font-800 text-fresh">{stats.fresh}</span>
            <span className="text-neutral-400">Fresh</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="text-2xl">🤢</span>
            <span className="font-800 text-rotten">{stats.rotten}</span>
            <span className="text-neutral-400">Rotten</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="font-800 text-mid">{stats.avg}%</span>
            <span className="text-neutral-400">avg</span>
          </span>
        </div>
      </div>

      {/* Posts */}
      {filteredPosts.length === 0 ? (
        <p className="text-neutral-400 text-2xl py-20 text-center">No projects this month.</p>
      ) : (
        <PostsTable posts={filteredPosts} initialRatings={ratings} />
      )}
    </div>
  );
}
