import type { CSSProperties } from "react";
import type { ChartDatum, TimelineItem } from "../types";

export function DonutChart({ data, centerLabel = "Requests" }: { data: ChartDatum[]; centerLabel?: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const safeTotal = total || 1;
  const stops = data
    .map((item) => item.value / safeTotal)
    .reduce<{ start: number; end: number; color: string }[]>((acc, ratio, index) => {
      const previous = acc[index - 1]?.end ?? 0;
      acc.push({
        start: previous,
        end: previous + ratio * 100,
        color: data[index].color ?? "var(--accent)"
      });
      return acc;
    }, []);

  const background = `conic-gradient(${stops
    .map((stop) => `${stop.color} ${stop.start}% ${stop.end}%`)
    .join(", ")})`;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
      <div className="chart-figure chart-ring relative h-40 w-40 rounded-full" style={{ background }}>
        <div className="absolute inset-5 rounded-full bg-[var(--surface-card)]" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="headline-font text-2xl font-extrabold text-[var(--ink)]">{total}</div>
            <div className="text-xs font-medium text-[var(--muted)]">{centerLabel}</div>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={item.label} className="chart-legend-item flex items-center gap-3 text-sm" style={{ animationDelay: `${120 + index * 70}ms` }}>
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="min-w-24 text-[var(--muted)]">{item.label}</span>
            <span className="font-semibold text-[var(--ink)]">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineChart({ data }: { data: ChartDatum[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const chartPoints = data.map((item, index) => {
    const x = (index / Math.max(data.length - 1, 1)) * 100;
    const y = 100 - (item.value / max) * 100;
    return { x, y, label: item.label, value: item.value };
  });
  const points = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="space-y-4">
      <svg viewBox="0 0 100 100" className="chart-figure h-56 w-full overflow-visible rounded-xl bg-[var(--surface-low)] p-4">
        <polyline fill="none" stroke="rgba(84,95,115,0.2)" strokeWidth="1.2" strokeDasharray="2 2" points="0,88 100,88" />
        <polyline fill="none" stroke="#545f73" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength={100} points={points} className="chart-line" />
        {chartPoints.map((point, index) => (
          <circle
            key={point.label}
            cx={point.x}
            cy={point.y}
            r="2.6"
            fill="var(--surface-card)"
            stroke="#545f73"
            strokeWidth="1.6"
            className="chart-point"
            style={{ animationDelay: `${240 + index * 70}ms` }}
          />
        ))}
      </svg>
      <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-500 dark:text-slate-400">
        {data.map((item, index) => (
          <div key={item.label} className="chart-legend-item" style={{ animationDelay: `${140 + index * 60}ms` }}>
            <div>{item.label}</div>
            <div className="mt-1 font-semibold text-[var(--ink)]">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarChart({ data, valueSuffix = "%" }: { data: ChartDatum[]; valueSuffix?: string }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="space-y-4">
      {data.map((item, index) => (
        <div key={item.label} className="chart-legend-item space-y-2" style={{ animationDelay: `${120 + index * 70}ms` }}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--muted)]">{item.label}</span>
            <span className="font-semibold text-[var(--ink)]">
              {item.value}
              {valueSuffix}
            </span>
          </div>
          <div className="chart-figure chart-bar-track h-3 rounded-full bg-[var(--surface-container)]">
            <div
              className="chart-bar-fill h-full rounded-full"
              style={{
                background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-dim) 100%)",
                width: `${(item.value / max) * 100}%`,
                animationDelay: `${180 + index * 90}ms`
              } as CSSProperties}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Timeline({ items, compact = false }: { items: TimelineItem[]; compact?: boolean }) {
  const toneClass = {
    accent: "bg-blue-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500"
  };

  return (
    <div className={compact ? "max-h-[26rem] space-y-2 overflow-y-auto pr-1" : "space-y-4"}>
      {items.map((item, index) => (
        <div key={`${item.title}-${item.date}-${index}`} className={`chart-legend-item flex ${compact ? "gap-3" : "gap-4"}`}>
          <div className="flex flex-col items-center">
            <span className={`${compact ? "mt-1 h-2.5 w-2.5" : "mt-1 h-3.5 w-3.5"} rounded-full ${toneClass[item.tone]}`} />
            {index < items.length - 1 ? <span className={`${compact ? "mt-1.5" : "mt-2"} h-full w-px bg-[var(--surface-container)]`} /> : null}
          </div>
          {compact ? (
            <div className="min-w-0 flex-1 rounded-lg border border-[var(--surface-container)] bg-[var(--surface-low)] px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <p className="truncate text-sm font-semibold text-[var(--ink)]">{item.title}</p>
                <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]/80">{item.date}</p>
              </div>
              <p className="mt-1 text-sm leading-snug text-[var(--muted)]">{item.subtitle}</p>
            </div>
          ) : (
            <div className="pb-5">
              <p className="font-semibold text-[var(--ink)]">{item.title}</p>
              <p className="text-sm text-[var(--muted)]">{item.subtitle}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]/80">{item.date}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
