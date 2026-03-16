import type { ChartDatum, TimelineItem } from "../types";

export function DonutChart({ data }: { data: ChartDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const stops = data
    .map((item) => item.value / total)
    .reduce<{ start: number; end: number; color: string }[]>((acc, ratio, index) => {
      const previous = acc[index - 1]?.end ?? 0;
      acc.push({
        start: previous,
        end: previous + ratio * 100,
        color: data[index].color ?? "#2563eb"
      });
      return acc;
    }, []);

  const background = `conic-gradient(${stops
    .map((stop) => `${stop.color} ${stop.start}% ${stop.end}%`)
    .join(", ")})`;

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-40 w-40 rounded-full" style={{ background }}>
        <div className="absolute inset-5 rounded-full bg-white dark:bg-slate-950" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="font-display text-2xl font-bold text-slate-900 dark:text-white">{total}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Requests</div>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.label} className="flex items-center gap-3 text-sm">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="min-w-24 text-slate-600 dark:text-slate-300">{item.label}</span>
            <span className="font-semibold text-slate-900 dark:text-white">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineChart({ data }: { data: ChartDatum[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const points = data
    .map((item, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 100;
      const y = 100 - (item.value / max) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="space-y-4">
      <svg viewBox="0 0 100 100" className="h-56 w-full overflow-visible rounded-[22px] bg-slate-100/80 p-4 dark:bg-slate-900/80">
        <polyline fill="none" stroke="#93c5fd" strokeWidth="1.2" strokeDasharray="2 2" points="0,88 100,88" />
        <polyline fill="none" stroke="#2563eb" strokeWidth="2.2" points={points} />
      </svg>
      <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-500 dark:text-slate-400">
        {data.map((item) => (
          <div key={item.label}>
            <div>{item.label}</div>
            <div className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarChart({ data }: { data: ChartDatum[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.label} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
            <span className="font-semibold text-slate-900 dark:text-white">{item.value}%</span>
          </div>
          <div className="h-3 rounded-full bg-slate-200 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  const toneClass = {
    accent: "bg-blue-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500"
  };

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={`${item.title}-${item.date}`} className="flex gap-4">
          <div className="flex flex-col items-center">
            <span className={`mt-1 h-3.5 w-3.5 rounded-full ${toneClass[item.tone]}`} />
            <span className="mt-2 h-full w-px bg-slate-200 dark:bg-white/10" />
          </div>
          <div className="pb-5">
            <p className="font-semibold text-slate-900 dark:text-white">{item.title}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{item.subtitle}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{item.date}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
