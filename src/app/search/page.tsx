import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PostsTable from "@/components/PostsTable";
import SearchBox, { type SearchFilters } from "@/components/SearchBox";
import { Prisma } from "@/generated/prisma/client";

type RawSearchParams = {
  q?: string;
  from?: string;
  to?: string;
  minUpvotes?: string;
  minScore?: string;
  category?: string;
  sort?: string;
};

type SortKey = "upvotes" | "newest" | "score";
const SORT_KEYS: readonly SortKey[] = ["upvotes", "newest", "score"];

function parseInt0(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(23, 59, 59, 999);
  return out;
}

function buildOrderBy(sort: SortKey): Prisma.ShowHnPostOrderByWithRelationInput[] {
  if (sort === "newest") return [{ postedAt: "desc" }];
  if (sort === "score")
    return [{ aiScore: { sort: "desc", nulls: "last" } }, { upvotes: "desc" }];
  return [{ upvotes: "desc" }, { postedAt: "desc" }];
}

const POSTS_TABLE_SORT: Record<SortKey, "upvotes" | "postedAt" | "aiScore"> = {
  upvotes: "upvotes",
  newest: "postedAt",
  score: "aiScore",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const from = parseDate(sp.from);
  const to = parseDate(sp.to);
  const minUpvotes = parseInt0(sp.minUpvotes);
  const minScoreRaw = parseInt0(sp.minScore);
  const minScore = minScoreRaw != null ? Math.min(minScoreRaw, 100) : null;
  const category = sp.category?.trim() || null;
  const sort: SortKey = SORT_KEYS.includes(sp.sort as SortKey)
    ? (sp.sort as SortKey)
    : "upvotes";

  const hasFilter =
    query.length > 0 ||
    from !== null ||
    to !== null ||
    minUpvotes !== null ||
    minScore !== null ||
    category !== null;

  const where: Prisma.ShowHnPostWhereInput = {};
  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { aiSummary: { contains: query, mode: "insensitive" } },
      { siteDescription: { contains: query, mode: "insensitive" } },
      { summary: { contains: query, mode: "insensitive" } },
    ];
  }
  if (from || to) {
    where.postedAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: endOfDay(to) } : {}),
    };
  }
  if (minUpvotes != null) where.upvotes = { gte: minUpvotes };
  if (minScore != null) where.aiScore = { gte: minScore, not: null };
  if (category) where.category = category;

  const [posts, ratings, categoryRows] = await Promise.all([
    hasFilter
      ? prisma.showHnPost.findMany({
          where,
          orderBy: buildOrderBy(sort),
          take: 200,
          include: { rating: { select: { value: true } } },
        })
      : Promise.resolve([]),
    hasFilter
      ? prisma.userRating.findMany({
          select: { postId: true, value: true, reason: true },
        })
      : Promise.resolve([]),
    prisma.showHnPost.findMany({
      where: { category: { not: null } },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    }),
  ]);

  const categories = categoryRows
    .map((r) => r.category)
    .filter((c): c is string => c !== null);

  const serialized = posts.map((p) => {
    const liked = p.rating?.value === 1;
    const notable =
      liked ||
      (p.aiScore != null && p.aiScore >= 80) ||
      p.upvotes >= 100 ||
      (p.aiScore != null && p.aiScore >= 70 && p.upvotes >= 30);
    return {
      ...p,
      rating: undefined,
      postedAt: p.postedAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
      notable,
    };
  });

  const initialFilters: SearchFilters = {
    from: sp.from,
    to: sp.to,
    minUpvotes: sp.minUpvotes,
    minScore: sp.minScore,
    category: category ?? undefined,
    sort,
  };

  const extraFiltersActive =
    from !== null ||
    to !== null ||
    minUpvotes !== null ||
    minScore !== null ||
    category !== null ||
    sort !== "upvotes";

  const clearHref = query
    ? `/search?q=${encodeURIComponent(query)}`
    : "/search";

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6 md:py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-10 text-sm font-700 uppercase tracking-widest text-neutral-400 hover:text-neutral-900 transition-colors"
      >
        <span aria-hidden>⌂</span>
        <span>All days</span>
      </Link>

      <header className="mb-10">
        <div className="flex items-baseline justify-between flex-wrap gap-4 pb-6 border-b-4 border-neutral-900">
          <h1 className="text-4xl md:text-5xl font-800 tracking-tight">
            <span className="text-neutral-900">Search</span>
            {query && (
              <span className="text-neutral-400 ml-3 font-mono text-2xl md:text-3xl">
                “{query}”
              </span>
            )}
          </h1>
          <div className="font-mono text-base text-neutral-500">
            <span className="text-neutral-900 font-800">{serialized.length}</span>{" "}
            {serialized.length === 1 ? "match" : "matches"}
          </div>
        </div>
        <div className="mt-6">
          <SearchBox
            initialQuery={query}
            initialFilters={initialFilters}
            categories={categories}
            autoFocus
          />
        </div>
        {extraFiltersActive && (
          <div className="mt-3">
            <Link
              href={clearHref}
              className="text-xs font-700 uppercase tracking-widest text-neutral-400 hover:text-neutral-900 transition-colors"
            >
              ✕ Clear filters
            </Link>
          </div>
        )}
      </header>

      {!hasFilter ? (
        <div className="text-center py-20 text-neutral-400 text-lg">
          Type a query or set a filter to search titles, summaries, and descriptions.
        </div>
      ) : serialized.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-neutral-400 text-lg mb-4">
            No posts match your filters.
          </p>
        </div>
      ) : (
        <PostsTable
          posts={serialized}
          initialRatings={ratings}
          initialSortField={POSTS_TABLE_SORT[sort]}
        />
      )}
    </div>
  );
}
