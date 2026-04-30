"use client";

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

function pruneEmpties(form: HTMLFormElement) {
  for (const el of Array.from(form.elements)) {
    if (
      (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) &&
      el.name &&
      el.value === ""
    ) {
      el.disabled = true;
    }
  }
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
  return (
    <form
      action="/search"
      method="GET"
      role="search"
      onSubmit={(e) => pruneEmpties(e.currentTarget)}
      className="flex flex-col gap-3 w-full"
    >
      <div className="flex items-stretch gap-2 w-full">
        <input
          type="search"
          name="q"
          defaultValue={initialQuery}
          autoFocus={autoFocus}
          placeholder="Search products by title, summary, or description…"
          aria-label="Search products"
          className="flex-1 px-4 py-3 border-2 border-neutral-200 rounded-xl text-base font-500 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
        />
        <button
          type="submit"
          className="px-5 py-3 border-2 border-neutral-900 bg-neutral-900 text-white rounded-xl text-sm font-700 uppercase tracking-widest hover:bg-white hover:text-neutral-900 transition-colors"
        >
          Search
        </button>
      </div>

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
              defaultValue={initialFilters.from ?? ""}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>To</span>
            <input
              type="date"
              name="to"
              defaultValue={initialFilters.to ?? ""}
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
              defaultValue={initialFilters.minUpvotes ?? ""}
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
              defaultValue={initialFilters.minScore ?? ""}
              placeholder="0–100"
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Category</span>
            <select
              name="category"
              defaultValue={initialFilters.category ?? ""}
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
              defaultValue={initialFilters.sort ?? "upvotes"}
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
