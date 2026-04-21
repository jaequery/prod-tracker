"use client";

import { useState } from "react";

type AiDetails = {
  targetAudience?: string;
  whyItMatters?: string;
  vibe?: string;
  techStack?: string;
  dimensions?: unknown[];
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
  previewImage: string | null;
  siteDescription: string | null;
};

type Rating = { postId: number; value: number; reason: string | null };

type SortField = "postedAt" | "upvotes" | "numComments" | "aiScore";
type SortDir = "asc" | "desc";

function sortPosts(posts: Post[], field: SortField, dir: SortDir): Post[] {
  const mult = dir === "asc" ? 1 : -1;
  return [...posts].sort((a, b) => {
    if (field === "postedAt") {
      return mult * (new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime());
    }
    return mult * (((a[field] as number) ?? 0) - ((b[field] as number) ?? 0));
  });
}

function getVerdict(score: number) {
  if (score >= 70) return { label: "Fresh", icon: "🍅", color: "text-fresh" };
  if (score >= 40) return { label: "Mid", icon: "🍿", color: "text-mid" };
  return { label: "Rotten", icon: "🤢", color: "text-rotten" };
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

function shouldShowPreview(url: string): boolean {
  try {
    return !new URL(url).hostname.includes("news.ycombinator.com");
  } catch {
    return false;
  }
}

function groupByDay(posts: Post[]): Map<string, Post[]> {
  const groups = new Map<string, Post[]>();
  for (const post of posts) {
    const day = new Date(post.postedAt).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(post);
  }
  return groups;
}

export default function PostsTable({
  posts,
  initialRatings = [],
}: {
  posts: Post[];
  initialRatings?: Rating[];
}) {
  const [sortField, setSortField] = useState<SortField>("aiScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Map<number, Rating>>(
    () => new Map(initialRatings.map((r) => [r.postId, r])),
  );
  const [reasonOpen, setReasonOpen] = useState<number | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  async function saveRating(postId: number, value: 1 | -1, reason: string | null) {
    const prev = ratings.get(postId) ?? null;
    const next = new Map(ratings);
    next.set(postId, { postId, value, reason });
    setRatings(next);
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, value, reason }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("saveRating failed", err);
      const rollback = new Map(ratings);
      if (prev) rollback.set(postId, prev);
      else rollback.delete(postId);
      setRatings(rollback);
    }
  }

  async function clearRating(postId: number) {
    const prev = ratings.get(postId) ?? null;
    const next = new Map(ratings);
    next.delete(postId);
    setRatings(next);
    try {
      const res = await fetch(`/api/ratings?postId=${postId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("clearRating failed", err);
      const rollback = new Map(ratings);
      if (prev) rollback.set(postId, prev);
      setRatings(rollback);
    }
  }

  function toggleThumb(postId: number, value: 1 | -1) {
    const current = ratings.get(postId);
    if (current?.value === value) {
      clearRating(postId);
      if (reasonOpen === postId) setReasonOpen(null);
      return;
    }
    saveRating(postId, value, current?.reason ?? null);
    setReasonDraft(current?.reason ?? "");
    setReasonOpen(postId);
  }

  function submitReason(postId: number) {
    const current = ratings.get(postId);
    if (!current) return;
    const reason = reasonDraft.trim() || null;
    saveRating(postId, current.value as 1 | -1, reason);
    setReasonOpen(null);
    setReasonDraft("");
  }

  const groups = groupByDay(posts);

  const sortBtnClass = (field: SortField) =>
    `text-base font-600 cursor-pointer transition-colors ${
      field === sortField
        ? "text-neutral-900 underline underline-offset-4 decoration-2"
        : "text-neutral-400 hover:text-neutral-600"
    }`;

  return (
    <div>
      {/* Sort */}
      <div className="flex items-center gap-6 mb-10">
        <span className="text-sm text-neutral-400 uppercase tracking-widest font-600">Sort</span>
        <button onClick={() => handleSort("aiScore")} className={sortBtnClass("aiScore")}>
          Score {sortField === "aiScore" && (sortDir === "asc" ? "↑" : "↓")}
        </button>
        <button onClick={() => handleSort("upvotes")} className={sortBtnClass("upvotes")}>
          Upvotes {sortField === "upvotes" && (sortDir === "asc" ? "↑" : "↓")}
        </button>
        <button onClick={() => handleSort("numComments")} className={sortBtnClass("numComments")}>
          Comments {sortField === "numComments" && (sortDir === "asc" ? "↑" : "↓")}
        </button>
      </div>

      <div className="space-y-14">
        {Array.from(groups.entries()).map(([day, dayPosts]) => {
          const sorted = sortPosts(dayPosts, sortField, sortDir);
          const limit = 10;
          const isExpanded = expandedDays.has(day);
          const visible = isExpanded ? sorted : sorted.slice(0, limit);
          const hiddenCount = sorted.length - limit;

          return (
            <section key={day}>
              <h3 className="text-sm text-neutral-400 uppercase tracking-widest font-600 mb-6 border-b border-neutral-100 pb-3">
                {day} · {dayPosts.length} projects
              </h3>

              <div className="space-y-0">
                {visible.map((post) => {
                  const hostname = getHostname(post.url);
                  const hnLink = `https://news.ycombinator.com/item?id=${post.hnId}`;
                  const details = post.aiScoreDetails as AiDetails | null;
                  const det = details && typeof details === "object" && !Array.isArray(details) ? details : null;
                  const whyItMatters = det?.whyItMatters ?? null;
                  const vibe = det?.vibe ?? null;
                  const techStack = det?.techStack ?? null;
                  const verdict = post.aiScore != null ? getVerdict(post.aiScore) : null;
                  const screenshot =
                    post.previewImage && shouldShowPreview(post.url) ? post.previewImage : null;

                  return (
                    <div key={post.id} className="border-b border-neutral-50 last:border-b-0">
                      <div className="py-7 flex items-start gap-6">
                        {/* Score */}
                        {verdict && post.aiScore != null ? (
                          <div className="shrink-0 w-20 flex flex-col items-center">
                            <span className="text-4xl">{verdict.icon}</span>
                            <span className={`text-2xl font-800 font-mono ${verdict.color}`}>
                              {post.aiScore}
                            </span>
                          </div>
                        ) : (
                          <div className="shrink-0 w-20 flex flex-col items-center opacity-20">
                            <span className="text-4xl">🍅</span>
                            <span className="text-lg text-neutral-400">—</span>
                          </div>
                        )}

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <a
                            href={hnLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xl font-700 leading-snug text-neutral-900 hover:text-fresh transition-colors"
                          >
                            {post.title}
                          </a>
                          {hostname && (
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-base text-neutral-400 hover:text-neutral-600 transition-colors"
                            >
                              {hostname} ↗
                            </a>
                          )}

                          {/* Site's own description */}
                          {post.siteDescription && (
                            <p className="mt-2 text-base text-neutral-600 leading-relaxed">
                              {post.siteDescription}
                            </p>
                          )}

                          {/* AI summary */}
                          {post.aiSummary && (
                            <p className="mt-2 text-base text-neutral-500 leading-relaxed italic">
                              {post.aiSummary}
                            </p>
                          )}

                          {/* Why it matters — the standout line */}
                          {whyItMatters && (
                            <p className="mt-2 text-base font-600 text-neutral-700">
                              → {whyItMatters}
                            </p>
                          )}

                          {/* Meta */}
                          <div className="mt-3 flex items-center gap-4 flex-wrap text-base">
                            <span className="font-mono text-neutral-400">▲ {post.upvotes}</span>
                            <span className="font-mono text-neutral-400">◇ {post.numComments}</span>
                            {vibe && (
                              <span className="bg-neutral-100 text-neutral-600 px-3 py-1 rounded-full font-500 italic text-sm">
                                {vibe}
                              </span>
                            )}
                            {techStack && (
                              <span className="font-mono text-neutral-400 text-sm">{techStack}</span>
                            )}
                            {verdict && (
                              <span className={`font-700 ${verdict.color}`}>{verdict.label}</span>
                            )}

                            {/* Rating thumbs */}
                            {(() => {
                              const rating = ratings.get(post.id);
                              const up = rating?.value === 1;
                              const down = rating?.value === -1;
                              return (
                                <span className="ml-auto flex items-center gap-1">
                                  <button
                                    onClick={() => toggleThumb(post.id, 1)}
                                    title={up ? "Rated good (click to clear)" : "Rate as good Show HN"}
                                    className={`px-2 py-1 rounded-full text-lg transition-all cursor-pointer ${
                                      up
                                        ? "bg-fresh/10 text-fresh"
                                        : "text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100"
                                    }`}
                                  >
                                    👍
                                  </button>
                                  <button
                                    onClick={() => toggleThumb(post.id, -1)}
                                    title={down ? "Rated bad (click to clear)" : "Rate as bad Show HN"}
                                    className={`px-2 py-1 rounded-full text-lg transition-all cursor-pointer ${
                                      down
                                        ? "bg-rotten/10 text-rotten"
                                        : "text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100"
                                    }`}
                                  >
                                    👎
                                  </button>
                                </span>
                              );
                            })()}
                          </div>

                          {/* Saved rating reason */}
                          {(() => {
                            const rating = ratings.get(post.id);
                            if (!rating?.reason || reasonOpen === post.id) return null;
                            return (
                              <p className="mt-2 text-sm italic text-neutral-500">
                                <span className="font-600 not-italic text-neutral-400">
                                  {rating.value === 1 ? "Liked:" : "Disliked:"}
                                </span>{" "}
                                {rating.reason}{" "}
                                <button
                                  onClick={() => {
                                    setReasonOpen(post.id);
                                    setReasonDraft(rating.reason ?? "");
                                  }}
                                  className="text-neutral-400 hover:text-neutral-700 cursor-pointer underline underline-offset-2"
                                >
                                  edit
                                </button>
                              </p>
                            );
                          })()}

                          {/* Reason input */}
                          {reasonOpen === post.id && ratings.get(post.id) && (
                            <div className="mt-3 flex items-start gap-2">
                              <textarea
                                autoFocus
                                value={reasonDraft}
                                onChange={(e) => setReasonDraft(e.target.value)}
                                placeholder="Why? (optional) — e.g. novel approach, solid craft, clone of X…"
                                className="flex-1 text-sm border border-neutral-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:border-neutral-500"
                                rows={2}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                    submitReason(post.id);
                                  }
                                  if (e.key === "Escape") {
                                    setReasonOpen(null);
                                    setReasonDraft("");
                                  }
                                }}
                              />
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => submitReason(post.id)}
                                  className="text-sm font-600 px-3 py-1.5 bg-neutral-900 text-white rounded-md hover:bg-neutral-700 cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setReasonOpen(null);
                                    setReasonDraft("");
                                  }}
                                  className="text-sm text-neutral-400 hover:text-neutral-700 cursor-pointer"
                                >
                                  Skip
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Screenshot preview */}
                        {screenshot && (
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 hidden sm:block w-40 h-28 rounded-md overflow-hidden border border-neutral-100 bg-neutral-50 hover:border-neutral-300 transition-colors"
                          >
                            <img
                              src={screenshot}
                              alt={`${hostname ?? "site"} preview`}
                              loading="lazy"
                              className="w-full h-full object-cover object-top"
                            />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {hiddenCount > 0 && (
                <button
                  onClick={() => {
                    setExpandedDays((prev) => {
                      const next = new Set(prev);
                      if (next.has(day)) next.delete(day);
                      else next.add(day);
                      return next;
                    });
                  }}
                  className="mt-4 text-base font-600 text-neutral-400 hover:text-neutral-900 cursor-pointer transition-colors"
                >
                  {isExpanded ? "Show less" : `+ ${hiddenCount} more`}
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
