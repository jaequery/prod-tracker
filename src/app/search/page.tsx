import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PostsTable from "@/components/PostsTable";
import SearchBox from "@/components/SearchBox";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const posts = query
    ? await prisma.showHnPost.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { aiSummary: { contains: query, mode: "insensitive" } },
            { siteDescription: { contains: query, mode: "insensitive" } },
            { summary: { contains: query, mode: "insensitive" } },
          ],
        },
        orderBy: [{ upvotes: "desc" }, { postedAt: "desc" }],
        take: 200,
        include: { rating: { select: { value: true } } },
      })
    : [];

  const ratings = query
    ? await prisma.userRating.findMany({
        select: { postId: true, value: true, reason: true },
      })
    : [];

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
          <SearchBox initialQuery={query} autoFocus />
        </div>
      </header>

      {!query ? (
        <div className="text-center py-20 text-neutral-400 text-lg">
          Type a query to search titles, summaries, and descriptions.
        </div>
      ) : serialized.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-neutral-400 text-lg mb-4">
            No posts match “{query}”.
          </p>
        </div>
      ) : (
        <PostsTable posts={serialized} initialRatings={ratings} initialSortField="upvotes" />
      )}
    </div>
  );
}
