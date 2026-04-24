import Link from "next/link";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type DayCount = {
  key: string;
  count: number;
  fresh: number;
  rotten: number;
  notable: number;
  notableTitles: string[];
};

export default function Calendar({
  dayCounts,
  monthKey,
}: {
  dayCounts: DayCount[];
  monthKey: string;
}) {
  const counts = new Map(dayCounts.map((d) => [d.key, d]));
  const [year, monthNum] = monthKey.split("-").map(Number);
  const monthIdx = monthNum - 1;

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  // Build month grid: start at first Sunday on or before the 1st, end at last Sat on or after end.
  const firstOfMonth = new Date(Date.UTC(year, monthIdx, 1));
  const lastOfMonth = new Date(Date.UTC(year, monthIdx + 1, 0));
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - firstOfMonth.getUTCDay());
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - lastOfMonth.getUTCDay()));
  const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000) + 1;
  const weeks = totalDays / 7;

  const grid: {
    key: string;
    date: Date;
    count: number;
    fresh: number;
    rotten: number;
    notable: number;
    notableTitles: string[];
    inMonth: boolean;
    inFuture: boolean;
    isToday: boolean;
  }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: typeof grid[number] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart);
      date.setUTCDate(gridStart.getUTCDate() + w * 7 + d);
      const k = dayKey(date);
      const rec = counts.get(k);
      row.push({
        key: k,
        date,
        count: rec?.count ?? 0,
        fresh: rec?.fresh ?? 0,
        rotten: rec?.rotten ?? 0,
        notable: rec?.notable ?? 0,
        notableTitles: rec?.notableTitles ?? [],
        inMonth: date.getUTCMonth() === monthIdx && date.getUTCFullYear() === year,
        inFuture: date > todayUtc,
        isToday: date.getTime() === todayUtc.getTime(),
      });
    }
    grid.push(row);
  }

  // Stats only for in-month days.
  const inMonthDays = grid.flat().filter((d) => d.inMonth && !d.inFuture);
  const max = Math.max(...inMonthDays.map((d) => d.count), 1);
  const totalLaunched = inMonthDays.reduce((s, d) => s + d.count, 0);
  const totalFresh = inMonthDays.reduce((s, d) => s + d.fresh, 0);
  const totalRotten = inMonthDays.reduce((s, d) => s + d.rotten, 0);

  // DOW averages within in-month days.
  const totals = [0, 0, 0, 0, 0, 0, 0];
  const days = [0, 0, 0, 0, 0, 0, 0];
  for (const d of inMonthDays) {
    const w = d.date.getUTCDay();
    totals[w] += d.count;
    days[w] += 1;
  }
  const dowAvg = totals.map((t, i) => (days[i] ? t / days[i] : 0));
  const ranked = dowAvg
    .map((v, i) => ({ i, v }))
    .filter((x) => x.v > 0)
    .sort((a, b) => a.v - b.v);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  const monthLabel = firstOfMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const prevMonth = shiftMonth(monthKey, -1);
  const nextMonth = shiftMonth(monthKey, 1);
  const currentMonthKey = `${todayUtc.getUTCFullYear()}-${String(todayUtc.getUTCMonth() + 1).padStart(2, "0")}`;
  const isCurrent = monthKey === currentMonthKey;

  return (
    <div className="h-screen flex flex-col max-w-[1400px] mx-auto px-4 py-3">
      {/* Header */}
      <header className="flex items-center justify-between mb-2 flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍅</span>
          <h1 className="text-xl font-800 tracking-tight">Show HN</h1>
          <div className="flex items-center gap-1 ml-2">
            <Link
              href={`/?month=${prevMonth}`}
              className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 cursor-pointer"
              aria-label="Previous month"
            >
              ←
            </Link>
            <h2 className="text-xl font-800 tracking-tight px-2 min-w-[10rem] text-center">
              {monthLabel}
            </h2>
            <Link
              href={`/?month=${nextMonth}`}
              className={`w-7 h-7 flex items-center justify-center rounded-md cursor-pointer ${
                isCurrent
                  ? "text-neutral-200 pointer-events-none"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
              aria-label="Next month"
              aria-disabled={isCurrent}
            >
              →
            </Link>
            {!isCurrent && (
              <Link
                href="/"
                className="ml-1 text-[10px] font-700 uppercase tracking-wider text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                today
              </Link>
            )}
          </div>
        </div>
        <div className="text-xs font-mono text-neutral-500">
          <span className="text-neutral-900 font-700">{totalLaunched}</span> launched ·{" "}
          <span className="text-fresh font-700">{totalFresh}</span> 🍅 ·{" "}
          <span className="text-rotten font-700">{totalRotten}</span> 🤢
          {best && worst && best.i !== worst.i && (
            <>
              <span className="mx-2">·</span>
              best <span className="text-rotten font-700">{DOW[best.i]}</span> {best.v.toFixed(1)} ·
              worst <span className="text-fresh font-700">{DOW[worst.i]}</span> {worst.v.toFixed(1)}
            </>
          )}
        </div>
      </header>

      {/* Calendar */}
      <div className="flex-1 min-h-0 border border-neutral-200 rounded-xl overflow-hidden flex flex-col">
        <div className="grid grid-cols-7 bg-neutral-50 border-b border-neutral-200 shrink-0">
          {DOW.map((lbl, i) => {
            const isWeekend = i === 0 || i === 6;
            return (
              <div
                key={lbl}
                className={`py-1 text-center text-[10px] font-700 uppercase tracking-widest border-r last:border-r-0 border-neutral-200 ${
                  isWeekend ? "text-neutral-400" : "text-neutral-700"
                }`}
              >
                {lbl}
              </div>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          {grid.map((week, wi) => (
            <div
              key={wi}
              className="grid grid-cols-7 border-b last:border-b-0 border-neutral-100 flex-1 min-h-0"
            >
              {week.map((d) => {
                const empty = d.count === 0;
                const dimOutOfMonth = !d.inMonth;

                if (d.inFuture || dimOutOfMonth) {
                  return (
                    <div
                      key={d.key}
                      className="border-r last:border-r-0 border-neutral-100 bg-neutral-50/40 relative"
                    >
                      {!d.inFuture && (
                        <span className="absolute top-1 left-1.5 text-[10px] font-500 text-neutral-300">
                          {d.date.getUTCDate()}
                        </span>
                      )}
                    </div>
                  );
                }

                const intensity = empty ? 0 : 0.08 + (d.count / max) * 0.92;
                const textDark = intensity > 0.55;

                const tooltip =
                  d.notable > 0
                    ? `⭐ ${d.notable} notable this day:\n• ${d.notableTitles.join("\n• ")}`
                    : undefined;

                return (
                  <Link
                    key={d.key}
                    href={empty ? "#" : `/day/${d.key}`}
                    aria-disabled={empty}
                    title={tooltip}
                    className={`relative border-r last:border-r-0 border-neutral-100 transition-all hover:z-10 hover:shadow-lg block ${
                      d.isToday ? "ring-2 ring-neutral-900 ring-inset z-[1]" : ""
                    } ${empty ? "pointer-events-none" : "cursor-pointer"}`}
                    style={{
                      backgroundColor: `rgba(250, 50, 10, ${intensity})`,
                    }}
                  >
                    <span
                      className={`absolute top-1 left-1.5 text-[10px] font-600 ${
                        textDark ? "text-white/85" : "text-neutral-500"
                      }`}
                    >
                      {d.date.getUTCDate()}
                    </span>
                    {d.notable > 0 && (
                      <span
                        className={`absolute top-1 right-1.5 text-[10px] font-700 px-1 rounded ${
                          textDark ? "bg-neutral-900/70 text-amber-300" : "bg-white/85 text-amber-600"
                        }`}
                      >
                        ⭐ {d.notable}
                      </span>
                    )}
                    <span
                      className={`absolute inset-0 flex items-center justify-center font-800 font-mono tabular-nums text-2xl md:text-3xl ${
                        textDark ? "text-white" : empty ? "text-neutral-200" : "text-neutral-900"
                      }`}
                    >
                      {d.count || "·"}
                    </span>
                    {d.isToday && (
                      <span
                        className={`absolute bottom-1 right-1.5 text-[9px] font-700 uppercase tracking-wider ${
                          textDark ? "text-white/85" : "text-neutral-500"
                        }`}
                      >
                        today
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 bg-neutral-50 border-t border-neutral-200 shrink-0">
          {dowAvg.map((v, i) => {
            const isBest = best?.i === i;
            const isWorst = worst?.i === i;
            return (
              <div
                key={i}
                className="py-1 text-center text-[11px] font-mono tabular-nums border-r last:border-r-0 border-neutral-200"
              >
                <span
                  className={`font-700 ${
                    isBest ? "text-rotten" : isWorst ? "text-fresh" : "text-neutral-500"
                  }`}
                >
                  {v.toFixed(1)}
                </span>
                <span className="text-neutral-400 ml-0.5">avg</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
