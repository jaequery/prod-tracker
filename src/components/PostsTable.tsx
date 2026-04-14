"use client";

import { useState } from "react";

type Dimension = {
  label: string;
  grade: string;
  comment: string;
};

type AiDetails = {
  targetAudience?: string;
  dimensions?: Dimension[];
  // legacy panel format
  role?: string;
  score?: number;
};

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
};

type SortField = "postedAt" | "upvotes" | "numComments" | "aiScore";
type SortDir = "default" | "asc" | "desc";

function nextDir(dir: SortDir): SortDir {
  if (dir === "default") return "asc";
  if (dir === "asc") return "desc";
  return "default";
}

function sortIndicator(field: SortField, activeField: SortField, dir: SortDir) {
  if (field !== activeField || dir === "default") return "";
  return dir === "asc" ? " \u2191" : " \u2193";
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
    return mult * (((a[field] as number) ?? 0) - ((b[field] as number) ?? 0));
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-rose-500 dark:text-rose-400";
}

function scoreBg(score: number): string {
  if (score >= 75) return "bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-inset ring-emerald-500/20";
  if (score >= 50) return "bg-amber-50 dark:bg-amber-950/30 ring-1 ring-inset ring-amber-500/20";
  return "bg-rose-50 dark:bg-rose-950/30 ring-1 ring-inset ring-rose-500/20";
}

function gradeColor(grade: string): string {
  if (grade === "A") return "text-emerald-600 dark:text-emerald-400";
  if (grade === "B") return "text-lime-600 dark:text-lime-400";
  if (grade === "C") return "text-amber-600 dark:text-amber-400";
  if (grade === "D") return "text-orange-500 dark:text-orange-400";
  return "text-rose-500 dark:text-rose-400";
}

function gradeBg(grade: string): string {
  if (grade === "A") return "bg-emerald-50 dark:bg-emerald-950/20";
  if (grade === "B") return "bg-lime-50 dark:bg-lime-950/20";
  if (grade === "C") return "bg-amber-50 dark:bg-amber-950/20";
  if (grade === "D") return "bg-orange-50 dark:bg-orange-950/20";
  return "bg-rose-50 dark:bg-rose-950/20";
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
  const [sortField, setSortField] = useState<SortField>("aiScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [expandedScores, setExpandedScores] = useState<Set<number>>(new Set());

  function toggleScore(id: number) {
    setExpandedScores((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    "px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer select-none transition-colors duration-150 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800";

  return (
    <div className="space-y-10">
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
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {day}
                </h2>
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                  {dayPosts.length} post{dayPosts.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-400 dark:text-zinc-500 mr-1">Sort:</span>
                <button onClick={() => handleSort("aiScore")} className={sortButtonClass}>
                  Score{sortIndicator("aiScore", sortField, sortDir)}
                </button>
                <button onClick={() => handleSort("upvotes")} className={sortButtonClass}>
                  Upvotes{sortIndicator("upvotes", sortField, sortDir)}
                </button>
                <button onClick={() => handleSort("numComments")} className={sortButtonClass}>
                  Comments{sortIndicator("numComments", sortField, sortDir)}
                </button>
                <button onClick={() => handleSort("postedAt")} className={sortButtonClass}>
                  Posted{sortIndicator("postedAt", sortField, sortDir)}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {visiblePosts.map((post) => {
                const hostname = getHostname(post.url);
                const hnLink = `https://news.ycombinator.com/item?id=${post.hnId}`;

                const showScorePanel = expandedScores.has(post.id);
                const details = post.aiScoreDetails as AiDetails | AiDetails[] | null;
                const isNewFormat = details && !Array.isArray(details) && "dimensions" in details;
                const dimensions = isNewFormat ? (details as AiDetails).dimensions : null;
                const targetAudience = isNewFormat ? (details as AiDetails).targetAudience : null;

                return (
                  <div
                    key={post.id}
                    className="group rounded-xl bg-white dark:bg-zinc-900/60 p-5 transition-all duration-200 hover:shadow-md ring-1 ring-zinc-100 dark:ring-zinc-800"
                  >
                    {/* Row 1: Score + Title + Hostname */}
                    <div className="flex items-start gap-4">
                      {post.aiScore != null && (
                        <button
                          onClick={() => toggleScore(post.id)}
                          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold tabular-nums cursor-pointer transition-all duration-150 hover:scale-105 ${scoreBg(post.aiScore)} ${scoreColor(post.aiScore)}`}
                          title="Click for breakdown"
                        >
                          {post.aiScore}
                        </button>
                      )}

                      <div className="min-w-0 flex-1">
                        {/* Title line */}
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <a
                            href={hnLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100 hover:text-amber-600 dark:hover:text-amber-400 transition-colors duration-150"
                          >
                            {post.title}
                          </a>
                          {hostname && (
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150"
                            >
                              {hostname}
                            </a>
                          )}
                        </div>

                        {/* Row 2: Audience pill + Summary */}
                        <div className="mt-1.5 flex items-start gap-2">
                          {targetAudience && (
                            <span className="shrink-0 inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 mt-0.5">
                              {targetAudience}
                            </span>
                          )}
                          {post.aiSummary && (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-1">
                              {post.aiSummary}
                            </p>
                          )}
                        </div>

                        {/* Row 3: Stats */}
                        <div className="mt-2 flex items-center gap-3 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2l6 8H2z"/></svg>
                            {post.upvotes}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h12v8H5l-3 3V3z"/></svg>
                            {post.numComments}
                          </span>
                          <span>{formatTime(post.postedAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Expandable grade breakdown */}
                    {showScorePanel && dimensions && (
                      <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
                        <div className="grid grid-cols-3 gap-3">
                          {dimensions.map((d) => (
                            <div
                              key={d.label}
                              className={`flex flex-col items-center gap-1 p-3 rounded-lg ${gradeBg(d.grade)}`}
                            >
                              <span className={`text-xl font-bold ${gradeColor(d.grade)}`}>
                                {d.grade}
                              </span>
                              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                                {d.label}
                              </span>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center leading-snug line-clamp-2">
                                {d.comment}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {hiddenCount > 0 && (
              <button
                onClick={toggleDay}
                className="mt-3 text-sm font-medium text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-150 cursor-pointer"
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
