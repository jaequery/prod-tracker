"use client";

import { useState } from "react";
import { categoryStyle } from "@/lib/categories";

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
  category: string | null;
  notable?: boolean;
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

function scoreColor(score: number | null): string {
  if (score == null) return "bg-neutral-100 text-neutral-400";
  if (score >= 70) return "bg-fresh/10 text-fresh";
  if (score >= 40) return "bg-mid/10 text-mid";
  return "bg-rotten/10 text-rotten";
}

function scoreIcon(score: number | null): string {
  if (score == null) return "·";
  if (score >= 70) return "🍅";
  if (score >= 40) return "🍿";
  return "🤢";
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

function groupByDay(posts: Post[]): Map<string, { label: string; dow: string; posts: Post[] }> {
  const groups = new Map<string, { label: string; dow: string; posts: Post[] }>();
  for (const post of posts) {
    const d = new Date(post.postedAt);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const dow = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    if (!groups.has(key)) groups.set(key, { label, dow, posts: [] });
    groups.get(key)!.posts.push(post);
  }
  return groups;
}

function dowColor(dow: string): string {
  // Weekend = lighter; keep weekday labels strong.
  if (dow === "Sat" || dow === "Sun") return "text-neutral-400";
  return "text-fresh";
}

export default function PostsTable({
  posts,
  initialRatings = [],
  initialSortField = "aiScore",
}: {
  posts: Post[];
  initialRatings?: Rating[];
  initialSortField?: SortField;
}) {
  const [sortField, setSortField] = useState<SortField>(initialSortField);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedPost, setExpandedPost] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [notableOnly, setNotableOnly] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const notableCount = posts.filter((p) => p.notable).length;

  const categoryCounts = (() => {
    const m = new Map<string, number>();
    for (const p of posts) {
      const c = p.category ?? "other";
      m.set(c, (m.get(c) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  })();

  const filteredPosts = posts.filter((p) => {
    if (notableOnly && !p.notable) return false;
    if (categoryFilter != null && (p.category ?? "other") !== categoryFilter) return false;
    return true;
  });

  const [ratings, setRatings] = useState<Map<number, Rating>>(
    () => new Map(initialRatings.map((r) => [r.postId, r])),
  );
  const [reasonOpen, setReasonOpen] = useState<number | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");

  function handleSort(field: SortField) {
    if (field === sortField) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
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

  function toggleThumb(e: React.MouseEvent, postId: number, value: 1 | -1) {
    e.stopPropagation();
    const current = ratings.get(postId);
    if (current?.value === value) {
      clearRating(postId);
      if (reasonOpen === postId) setReasonOpen(null);
      return;
    }
    saveRating(postId, value, current?.reason ?? null);
    setReasonDraft(current?.reason ?? "");
    setReasonOpen(postId);
    setExpandedPost(postId);
  }

  function submitReason(postId: number) {
    const current = ratings.get(postId);
    if (!current) return;
    const reason = reasonDraft.trim() || null;
    saveRating(postId, current.value as 1 | -1, reason);
    setReasonOpen(null);
    setReasonDraft("");
  }

  const sortIcon = (f: SortField) =>
    f === sortField ? (sortDir === "desc" ? "↓" : "↑") : "";
  const sortBtn = (f: SortField, label: string) => (
    <button
      type="button"
      onClick={() => handleSort(f)}
      aria-pressed={f === sortField}
      aria-label={
        f === sortField
          ? `Sorted by ${label} ${sortDir === "asc" ? "ascending" : "descending"}, click to reverse`
          : `Sort by ${label}`
      }
      className={`cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 rounded px-0.5 ${
        f === sortField ? "text-neutral-900 font-700" : "text-neutral-400 hover:text-neutral-700"
      }`}
    >
      {label} {sortIcon(f)}
    </button>
  );

  const groups = groupByDay(filteredPosts);

  return (
    <div>
      {/* Filter chips — big bold minimalist */}
      {categoryCounts.length > 1 && (
        <div
          role="group"
          aria-label="Filter posts"
          className="flex flex-wrap gap-2 mb-8"
        >
          <button
            type="button"
            onClick={() => {
              setCategoryFilter(null);
              setNotableOnly(false);
            }}
            aria-pressed={categoryFilter == null && !notableOnly}
            className={`text-sm font-800 uppercase tracking-wider px-4 py-2 border-2 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 ${
              categoryFilter == null && !notableOnly
                ? "bg-neutral-900 text-white border-neutral-900"
                : "border-neutral-200 text-neutral-500 hover:border-neutral-900 hover:text-neutral-900"
            }`}
          >
            All <span className="opacity-60 ml-1 font-mono">{posts.length}</span>
          </button>
          {notableCount > 0 && (
            <button
              type="button"
              onClick={() => setNotableOnly(!notableOnly)}
              aria-pressed={notableOnly}
              aria-label={`Filter to ${notableCount} notable posts`}
              className={`text-sm font-800 uppercase tracking-wider px-4 py-2 border-2 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                notableOnly
                  ? "bg-amber-500 text-white border-amber-500"
                  : "border-amber-300 text-amber-700 hover:border-amber-500 hover:bg-amber-50"
              }`}
            >
              <span aria-hidden>⭐</span> Notable <span className="opacity-70 ml-1 font-mono">{notableCount}</span>
            </button>
          )}
          {(() => {
            const visible = showAllCategories ? categoryCounts : categoryCounts.slice(0, 5);
            const hidden = categoryCounts.length - visible.length;
            const activeIsHidden =
              categoryFilter != null &&
              !visible.some(([c]) => c === categoryFilter);
            const renderChip = (cat: string, count: number, active: boolean) => {
              const style = categoryStyle(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(active ? null : cat)}
                  aria-pressed={active}
                  aria-label={`Filter to category ${style?.label ?? cat} (${count} posts)`}
                  className={`text-sm font-800 uppercase tracking-wider px-4 py-2 border-2 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 ${
                    active
                      ? "bg-neutral-900 text-white border-neutral-900"
                      : "border-neutral-200 text-neutral-500 hover:border-neutral-900 hover:text-neutral-900"
                  }`}
                >
                  {style?.label ?? cat} <span className="opacity-60 ml-1 font-mono">{count}</span>
                </button>
              );
            };
            return (
              <>
                {visible.map(([cat, count]) =>
                  renderChip(cat, count, categoryFilter === cat),
                )}
                {activeIsHidden &&
                  (() => {
                    const count =
                      categoryCounts.find(([c]) => c === categoryFilter)?.[1] ?? 0;
                    return renderChip(categoryFilter!, count, true);
                  })()}
                {hidden > 0 && !showAllCategories && (
                  <button
                    type="button"
                    onClick={() => setShowAllCategories(true)}
                    className="text-sm font-800 uppercase tracking-wider px-4 py-2 cursor-pointer text-neutral-400 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
                  >
                    + {hidden} more
                  </button>
                )}
                {showAllCategories && categoryCounts.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllCategories(false)}
                    className="text-sm font-800 uppercase tracking-wider px-4 py-2 cursor-pointer text-neutral-400 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
                  >
                    less
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Column header / sort bar */}
      <div className="sticky top-0 bg-white z-10 grid grid-cols-[3rem_1fr_auto_auto] md:grid-cols-[3rem_1fr_8rem_6rem] gap-3 px-2 py-2 border-b border-neutral-200 text-[11px] font-700 uppercase tracking-wider text-neutral-400">
        <div className="text-center">{sortBtn("aiScore", "Score")}</div>
        <div>Title</div>
        <div className="text-right">
          {sortBtn("upvotes", "Upvotes")} · {sortBtn("numComments", "Comments")}
        </div>
        <div className="text-center hidden md:block">Rate</div>
      </div>

      <div>
        {Array.from(groups.entries()).map(([key, g]) => {
          const sorted = sortPosts(g.posts, sortField, sortDir);
          const showDayHeader = groups.size > 1;
          return (
            <section key={key}>
              {showDayHeader && (
                <div className="sticky top-[38px] bg-white z-[5] px-2 py-3 border-b-2 border-neutral-900 flex items-baseline justify-between">
                  <h3 className="flex items-baseline gap-3">
                    <span className="text-3xl font-800 font-mono tabular-nums text-neutral-900">
                      {g.posts.length}
                    </span>
                    <span className="text-xs font-700 uppercase tracking-widest text-neutral-400">
                      launched
                    </span>
                  </h3>
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className={`font-800 uppercase tracking-wider ${dowColor(g.dow)}`}>
                      {g.dow}
                    </span>
                    <span className="text-neutral-700 font-600">{g.label}</span>
                  </div>
                </div>
              )}

              <ul>
                {sorted.map((post) => {
                  const hostname = getHostname(post.url);
                  const hnLink = `https://news.ycombinator.com/item?id=${post.hnId}`;
                  const details = post.aiScoreDetails as AiDetails | null;
                  const det =
                    details && typeof details === "object" && !Array.isArray(details) ? details : null;
                  const whyItMatters = det?.whyItMatters ?? null;
                  const techStack = det?.techStack ?? null;
                  const screenshot =
                    post.previewImage && shouldShowPreview(post.url) ? post.previewImage : null;
                  const isExpanded = expandedPost === post.id;
                  const rating = ratings.get(post.id);

                  return (
                    <li
                      key={post.id}
                      className={`border-b border-neutral-100 ${
                        isExpanded ? "bg-neutral-50" : "hover:bg-neutral-50/50"
                      } transition-colors`}
                    >
                      {/* Single-line row */}
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        aria-label={`${post.title}${post.notable ? ", notable" : ""}${post.aiScore != null ? `, score ${post.aiScore}` : ""}`}
                        onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setExpandedPost(isExpanded ? null : post.id);
                          }
                        }}
                        className="grid grid-cols-[3rem_1fr_auto_auto] md:grid-cols-[3rem_1fr_8rem_6rem] gap-3 items-center px-2 py-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-inset"
                      >
                        {/* Score badge */}
                        <div className="flex items-center justify-center">
                          <span
                            className={`inline-flex items-center justify-center w-11 h-8 rounded-md font-mono font-800 text-sm ${scoreColor(post.aiScore)}`}
                          >
                            {post.aiScore ?? "—"}
                          </span>
                        </div>

                        {/* Title + host */}
                        <div className="min-w-0 flex items-baseline gap-2">
                          <span className="text-[10px]">{scoreIcon(post.aiScore)}</span>
                          {post.notable && (
                            <span
                              title="Notable"
                              className="text-amber-500 text-sm leading-none"
                            >
                              ⭐
                            </span>
                          )}
                          <a
                            href={hnLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="font-600 text-neutral-900 hover:text-fresh truncate"
                          >
                            {post.title}
                          </a>
                          {hostname && (
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-neutral-400 hover:text-neutral-600 truncate"
                            >
                              {hostname}
                            </a>
                          )}
                          {(() => {
                            const cs = categoryStyle(post.category);
                            if (!cs) return null;
                            return (
                              <span
                                className={`shrink-0 text-[10px] font-700 px-1.5 py-0.5 rounded ${cs.color}`}
                              >
                                {cs.label}
                              </span>
                            );
                          })()}
                        </div>

                        {/* Metrics */}
                        <div className="font-mono text-xs text-neutral-500 text-right tabular-nums whitespace-nowrap">
                          ▲ {post.upvotes}
                          <span className="text-neutral-300 mx-1">·</span>
                          ◇ {post.numComments}
                        </div>

                        {/* Thumbs */}
                        <div className="hidden md:flex items-center justify-center gap-0.5" role="group" aria-label="Rate this post">
                          <button
                            type="button"
                            onClick={(e) => toggleThumb(e, post.id, 1)}
                            aria-pressed={rating?.value === 1}
                            aria-label={rating?.value === 1 ? "Remove good rating" : "Rate as good"}
                            title={rating?.value === 1 ? "Rated good (g)" : "Rate good (g)"}
                            className={`w-7 h-7 rounded cursor-pointer text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-fresh ${
                              rating?.value === 1
                                ? "bg-fresh/15 text-fresh"
                                : "text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100"
                            }`}
                          >
                            <span aria-hidden>👍</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => toggleThumb(e, post.id, -1)}
                            aria-pressed={rating?.value === -1}
                            aria-label={rating?.value === -1 ? "Remove bad rating" : "Rate as bad"}
                            title={rating?.value === -1 ? "Rated bad (b)" : "Rate bad (b)"}
                            className={`w-7 h-7 rounded cursor-pointer text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rotten ${
                              rating?.value === -1
                                ? "bg-rotten/15 text-rotten"
                                : "text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100"
                            }`}
                          >
                            <span aria-hidden>👎</span>
                          </button>
                        </div>
                      </div>

                      {/* Expanded */}
                      {isExpanded && (
                        <div className="px-2 pb-5 pt-1 grid grid-cols-1 md:grid-cols-[1fr_10rem] gap-5">
                          <div className="text-sm leading-relaxed space-y-2">
                            {post.siteDescription && (
                              <p className="text-neutral-700">{post.siteDescription}</p>
                            )}
                            {post.aiSummary && (
                              <p className="text-neutral-500 italic">{post.aiSummary}</p>
                            )}
                            {whyItMatters && (
                              <p className="font-600 text-neutral-800">→ {whyItMatters}</p>
                            )}
                            {techStack && (
                              <p className="font-mono text-xs text-neutral-400">{techStack}</p>
                            )}

                            {/* Mobile thumbs */}
                            <div className="flex md:hidden items-center gap-2 pt-2">
                              <button
                                onClick={(e) => toggleThumb(e, post.id, 1)}
                                className={`px-3 py-1 rounded-full text-sm cursor-pointer ${
                                  rating?.value === 1
                                    ? "bg-fresh/15 text-fresh"
                                    : "bg-neutral-100 text-neutral-500"
                                }`}
                              >
                                👍
                              </button>
                              <button
                                onClick={(e) => toggleThumb(e, post.id, -1)}
                                className={`px-3 py-1 rounded-full text-sm cursor-pointer ${
                                  rating?.value === -1
                                    ? "bg-rotten/15 text-rotten"
                                    : "bg-neutral-100 text-neutral-500"
                                }`}
                              >
                                👎
                              </button>
                            </div>

                            {rating?.reason && reasonOpen !== post.id && (
                              <p className="text-xs italic text-neutral-500 pt-1">
                                <span className="font-600 not-italic text-neutral-400">
                                  {rating.value === 1 ? "Liked:" : "Disliked:"}
                                </span>{" "}
                                {rating.reason}{" "}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReasonOpen(post.id);
                                    setReasonDraft(rating.reason ?? "");
                                  }}
                                  className="text-neutral-400 hover:text-neutral-700 cursor-pointer underline underline-offset-2"
                                >
                                  edit
                                </button>
                              </p>
                            )}

                            {reasonOpen === post.id && rating && (
                              <div className="flex items-start gap-2 pt-1">
                                <textarea
                                  autoFocus
                                  value={reasonDraft}
                                  onChange={(e) => setReasonDraft(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="Why? (optional)"
                                  className="flex-1 text-sm border border-neutral-200 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:border-neutral-500"
                                  rows={2}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                                      submitReason(post.id);
                                    if (e.key === "Escape") {
                                      setReasonOpen(null);
                                      setReasonDraft("");
                                    }
                                  }}
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    submitReason(post.id);
                                  }}
                                  className="text-xs font-600 px-3 py-1.5 bg-neutral-900 text-white rounded-md hover:bg-neutral-700 cursor-pointer"
                                >
                                  Save
                                </button>
                              </div>
                            )}
                          </div>

                          {screenshot && (
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="block w-full h-28 rounded-md overflow-hidden border border-neutral-200 bg-neutral-100 hover:border-neutral-400"
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
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
