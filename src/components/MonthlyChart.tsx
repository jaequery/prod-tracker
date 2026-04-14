"use client";

type Month = { key: string; label: string; count: number };

export default function MonthlyChart({
  months,
  selectedMonth,
  onSelectMonth,
}: {
  months: Month[];
  selectedMonth: string;
  onSelectMonth: (key: string) => void;
}) {
  const sorted = [...months].sort((a, b) => a.key.localeCompare(b.key));
  const max = Math.max(...sorted.map((m) => m.count), 1);

  return (
    <div className="mb-6 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
        Posts per Month
      </h3>
      <div className="flex items-end gap-1.5 h-[120px]">
        {sorted.map((m) => {
          const heightPct = (m.count / max) * 100;
          const isSelected = m.key === selectedMonth;
          const shortLabel = m.key.slice(2); // "YY-MM"
          return (
            <button
              key={m.key}
              onClick={() => onSelectMonth(m.key)}
              className="flex-1 flex flex-col items-center justify-end h-full min-w-0 group"
              title={`${m.label}: ${m.count} posts`}
            >
              <span className="text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {m.count}
              </span>
              <div
                className={`w-full max-w-[40px] rounded-t transition-all duration-200 ${
                  isSelected
                    ? "bg-orange-500"
                    : "bg-zinc-300 dark:bg-zinc-600 group-hover:bg-orange-300 dark:group-hover:bg-orange-700"
                }`}
                style={{ height: `${Math.max(heightPct, 2)}%` }}
              />
              <span
                className={`text-[9px] mt-1 truncate w-full text-center ${
                  isSelected
                    ? "text-orange-600 dark:text-orange-400 font-semibold"
                    : "text-zinc-400 dark:text-zinc-500"
                }`}
              >
                {shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
