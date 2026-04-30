import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PostsTable from "@/components/PostsTable";
import SearchBox from "@/components/SearchBox";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function shortDayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();

  const start = new Date(`${date}T00:00:00.000Z`);
  if (isNaN(start.getTime())) notFound();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const [posts, ratings] = await Promise.all([
    prisma.showHnPost.findMany({
      where: { postedAt: { gte: start, lt: end } },
      orderBy: { postedAt: "desc" },
      include: { rating: { select: { value: true } } },
    }),
    prisma.userRating.findMany({
      select: { postId: true, value: true, reason: true },
    }),
  ]);

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

  const dow = DOW[start.getUTCDay()];
  const dateLabel = start.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const scored = posts.filter((p) => p.aiScore != null);
  const fresh = scored.filter((p) => p.aiScore! >= 70).length;
  const rotten = scored.filter((p) => p.aiScore! < 40).length;
  const avg = scored.length
    ? Math.round(scored.reduce((s, p) => s + p.aiScore!, 0) / scored.length)
    : 0;

  const isWeekend = dow === "Sat" || dow === "Sun";

  const prev = new Date(start);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + 1);
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const isFuture = next > todayUtc;

  const prevKey = formatDayKey(prev);
  const nextKey = isFuture ? null : formatDayKey(next);
  const prevLbl = shortDayLabel(prev);
  const nextLbl = isFuture ? null : shortDayLabel(next);

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6 md:py-8">
      {/* All days link */}
      <div className="flex items-center gap-6 mb-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-700 uppercase tracking-widest text-neutral-400 hover:text-neutral-900 transition-colors whitespace-nowrap"
        >
          <span aria-hidden>⌂</span>
          <span>All days</span>
        </Link>
        <div className="flex-1">
          <SearchBox />
        </div>
      </div>

      {/* Hero: huge count + date with big arrows flanking */}
      <header className="mb-10">
        <div className="flex items-stretch gap-6 mb-6">
          <Link
            href={`/day/${prevKey}`}
            aria-label={`Previous day: ${prevLbl}`}
            className="group flex flex-col justify-center px-4 md:px-6 py-4 border-2 border-neutral-200 rounded-xl hover:border-neutral-900 hover:bg-neutral-900 hover:text-white transition-all min-w-[5rem] md:min-w-[9rem]"
          >
            <span className="text-3xl md:text-4xl font-800 leading-none" aria-hidden>
              ←
            </span>
            <span className="hidden md:block text-xs font-700 uppercase tracking-widest text-neutral-400 group-hover:text-white/70 mt-2">
              {prevLbl}
            </span>
          </Link>

          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="text-7xl md:text-9xl font-800 font-mono tabular-nums leading-none tracking-tighter">
              {posts.length}
            </span>
            <span className="text-xs md:text-sm font-700 uppercase tracking-[0.3em] text-neutral-400 mt-2">
              launched
            </span>
          </div>

          {nextKey && nextLbl ? (
            <Link
              href={`/day/${nextKey}`}
              aria-label={`Next day: ${nextLbl}`}
              className="group flex flex-col justify-center items-end px-4 md:px-6 py-4 border-2 border-neutral-200 rounded-xl hover:border-neutral-900 hover:bg-neutral-900 hover:text-white transition-all min-w-[5rem] md:min-w-[9rem]"
            >
              <span className="text-3xl md:text-4xl font-800 leading-none" aria-hidden>
                →
              </span>
              <span className="hidden md:block text-xs font-700 uppercase tracking-widest text-neutral-400 group-hover:text-white/70 mt-2">
                {nextLbl}
              </span>
            </Link>
          ) : (
            <div className="flex flex-col justify-center items-end px-4 md:px-6 py-4 border-2 border-neutral-100 rounded-xl min-w-[5rem] md:min-w-[9rem] text-neutral-200">
              <span className="text-3xl md:text-4xl font-800 leading-none" aria-hidden>
                →
              </span>
              <span className="hidden md:block text-xs font-700 uppercase tracking-widest mt-2">
                today
              </span>
            </div>
          )}
        </div>

        <div className="flex items-baseline justify-between flex-wrap gap-4 pb-6 border-b-4 border-neutral-900">
          <h1 className="text-4xl md:text-5xl font-800 tracking-tight">
            <span className={isWeekend ? "text-neutral-400" : "text-fresh"}>{dow}</span>
            <span className="text-neutral-900 ml-3">
              {start.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}
            </span>
          </h1>
          {posts.length > 0 && (
            <div className="font-mono text-base text-neutral-500">
              <span className="text-fresh font-800">{fresh}</span> 🍅
              <span className="mx-2 text-neutral-300">·</span>
              <span className="text-rotten font-800">{rotten}</span> 🤢
              <span className="mx-2 text-neutral-300">·</span>
              <span className="text-mid font-800">{avg}</span> avg
            </div>
          )}
        </div>
      </header>

      {posts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-neutral-400 text-lg mb-4">No Show HN posts on {dateLabel}.</p>
          <Link href="/" className="text-sm font-600 text-neutral-700 underline underline-offset-4">
            Pick another day
          </Link>
        </div>
      ) : (
        <PostsTable posts={serialized} initialRatings={ratings} initialSortField="upvotes" />
      )}
    </div>
  );
}
