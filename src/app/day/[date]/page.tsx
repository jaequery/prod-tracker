import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PostsTable from "@/components/PostsTable";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-10">
      {/* Back + header */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-600 text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          ← Calendar
        </Link>
      </div>

      <header className="mb-8 flex items-baseline justify-between flex-wrap gap-4 pb-5 border-b-2 border-neutral-900">
        <div className="flex items-baseline gap-4 flex-wrap">
          <span className="text-5xl font-800 font-mono tabular-nums text-neutral-900">
            {posts.length}
          </span>
          <div>
            <div className="text-xs font-700 uppercase tracking-widest text-neutral-400">
              launched
            </div>
            <h1 className="text-2xl font-800 tracking-tight">
              <span className={isWeekend ? "text-neutral-500" : "text-fresh"}>{dow}</span>{" "}
              <span className="text-neutral-900">
                {start.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </span>
            </h1>
          </div>
        </div>
        {posts.length > 0 && (
          <div className="font-mono text-sm text-neutral-500">
            <span className="text-fresh font-700">{fresh}</span> 🍅 ·{" "}
            <span className="text-rotten font-700">{rotten}</span> 🤢 ·{" "}
            <span className="text-mid font-700">{avg}</span> avg
          </div>
        )}
      </header>

      {posts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-neutral-400 text-lg mb-4">No Show HN posts on {dateLabel}.</p>
          <Link href="/" className="text-sm font-600 text-neutral-700 underline underline-offset-4">
            Pick another day
          </Link>
        </div>
      ) : (
        <PostsTable posts={serialized} initialRatings={ratings} />
      )}
    </div>
  );
}
