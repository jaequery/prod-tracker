"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { categoryLabel } from "@/lib/categories";

export type SearchFilters = {
  from?: string;
  to?: string;
  minUpvotes?: string;
  minScore?: string;
  category?: string;
  sort?: "upvotes" | "newest" | "score";
};

const FIELD_CLASS =
  "px-3 py-2 border-2 border-neutral-200 rounded-xl text-sm font-500 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors";
const LABEL_CLASS = "text-[11px] font-700 uppercase tracking-widest text-neutral-500";

const DEBOUNCE_MS = 250;

function buildQueryString(values: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) {
    if (v && v.length > 0) sp.set(k, v);
  }
  return sp.toString();
}

export default function SearchBox({
  initialQuery = "",
  initialFilters = {},
  categories = [],
  autoFocus = false,
}: {
  initialQuery?: string;
  initialFilters?: SearchFilters;
  categories?: string[];
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState(initialQuery);
  const [from, setFrom] = useState(initialFilters.from ?? "");
  const [to, setTo] = useState(initialFilters.to ?? "");
  const [minUpvotes, setMinUpvotes] = useState(initialFilters.minUpvotes ?? "");
  const [minScore, setMinScore] = useState(initialFilters.minScore ?? "");
  const [category, setCategory] = useState(initialFilters.category ?? "");
  const [sort, setSort] = useState<"upvotes" | "newest" | "score">(
    initialFilters.sort ?? "upvotes",
  );

  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  function navigate() {
    const qs = buildQueryString({
      q: query.trim(),
      from,
      to,
      minUpvotes,
      minScore,
      category,
      sort: sort === "upvotes" ? undefined : sort,
    });
    const target = `/search${qs ? `?${qs}` : ""}`;
    startTransition(() => {
      if (pathname === "/search") {
        router.replace(target);
      } else {
        router.push(target);
      }
    });
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (navTimer.current) clearTimeout(navTimer.current);
    navTimer.current = setTimeout(navigate, DEBOUNCE_MS);
    return () => {
      if (navTimer.current) clearTimeout(navTimer.current);
    };
    // navigate closes over current state; deps cover every driving field
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, from, to, minUpvotes, minScore, category, sort, pathname]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (navTimer.current) clearTimeout(navTimer.current);
    navigate();
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 w-full"
    >
      <input
        type="search"
        name="q"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Search products by title, summary, or description…"
        aria-label="Search products"
        className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl text-base font-500 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
      />

      <details open className="group">
        <summary className="md:hidden cursor-pointer list-none text-xs font-700 uppercase tracking-widest text-neutral-500 hover:text-neutral-900 select-none">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="group-open:rotate-90 transition-transform inline-block">
              ›
            </span>
            Filters
          </span>
        </summary>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-3 md:mt-0">
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>From</span>
            <input
              type="date"
              name="from"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>To</span>
            <input
              type="date"
              name="to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Min upvotes</span>
            <input
              type="number"
              name="minUpvotes"
              min={0}
              step={1}
              inputMode="numeric"
              value={minUpvotes}
              onChange={(e) => setMinUpvotes(e.target.value)}
              placeholder="0"
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Min score</span>
            <input
              type="number"
              name="minScore"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              placeholder="0–100"
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Category</span>
            <select
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={FIELD_CLASS}
            >
              <option value="">Any</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Sort</span>
            <select
              name="sort"
              value={sort}
              onChange={(e) =>
                setSort(e.target.value as "upvotes" | "newest" | "score")
              }
              className={FIELD_CLASS}
            >
              <option value="upvotes">Upvotes</option>
              <option value="newest">Newest</option>
              <option value="score">Score</option>
            </select>
          </label>
        </div>
      </details>
    </form>
  );
}
