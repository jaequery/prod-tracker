import { prisma } from "@/lib/prisma";
import Calendar, { type DayCount } from "@/components/Calendar";
import SearchBox from "@/components/SearchBox";

const MONTH_RE = /^\d{4}-\d{2}$/;

function isNotable(p: {
  aiScore: number | null;
  upvotes: number;
  liked: boolean;
}): boolean {
  if (p.liked) return true;
  if (p.aiScore != null && p.aiScore >= 80) return true;
  if (p.upvotes >= 100) return true;
  if (p.aiScore != null && p.aiScore >= 70 && p.upvotes >= 30) return true;
  return false;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const now = new Date();
  const monthKey =
    month && MONTH_RE.test(month)
      ? month
      : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const monthIdx = parseInt(monthStr, 10) - 1;

  const start = new Date(Date.UTC(year, monthIdx, 1));
  start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(Date.UTC(year, monthIdx + 1, 1));
  end.setUTCDate(end.getUTCDate() + 7);

  const posts = await prisma.showHnPost.findMany({
    where: { postedAt: { gte: start, lt: end } },
    select: {
      postedAt: true,
      title: true,
      aiScore: true,
      upvotes: true,
      rating: { select: { value: true } },
    },
  });

  type Agg = {
    count: number;
    fresh: number;
    rotten: number;
    notable: number;
    notables: { title: string; aiScore: number | null; upvotes: number; liked: boolean }[];
  };
  const map = new Map<string, Agg>();
  for (const p of posts) {
    const d = p.postedAt;
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const rec = map.get(k) ?? { count: 0, fresh: 0, rotten: 0, notable: 0, notables: [] };
    rec.count += 1;
    if (p.aiScore != null) {
      if (p.aiScore >= 70) rec.fresh += 1;
      else if (p.aiScore < 40) rec.rotten += 1;
    }
    const liked = p.rating?.value === 1;
    if (isNotable({ aiScore: p.aiScore, upvotes: p.upvotes, liked })) {
      rec.notable += 1;
      rec.notables.push({ title: p.title, aiScore: p.aiScore, upvotes: p.upvotes, liked });
    }
    map.set(k, rec);
  }

  const dayCounts: DayCount[] = Array.from(map.entries()).map(([key, v]) => {
    const top = [...v.notables]
      .sort((a, b) => {
        if (a.liked !== b.liked) return a.liked ? -1 : 1;
        const sa = a.aiScore ?? -1;
        const sb = b.aiScore ?? -1;
        if (sa !== sb) return sb - sa;
        return b.upvotes - a.upvotes;
      })
      .slice(0, 3)
      .map((n) => truncate(n.title, 80));
    return {
      key,
      count: v.count,
      fresh: v.fresh,
      rotten: v.rotten,
      notable: v.notable,
      notableTitles: top,
    };
  });

  return (
    <>
      <div className="max-w-[1100px] mx-auto px-6 pt-6 md:pt-8">
        <SearchBox />
      </div>
      <Calendar dayCounts={dayCounts} monthKey={monthKey} />
    </>
  );
}
