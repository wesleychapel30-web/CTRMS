import { formatDateTime } from "../lib/format";
import type { HistoryTimelineEntry, HistoryTimelineTone } from "../lib/historyTimeline";

type HistoryTimelineProps = {
  items: HistoryTimelineEntry[];
  emptyMessage?: string;
};

const toneStyles: Record<HistoryTimelineTone, { badge: string; avatar: string }> = {
  neutral: {
    badge: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    avatar: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900",
  },
  info: {
    badge: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200",
    avatar: "bg-blue-600 text-white dark:bg-blue-400 dark:text-slate-950",
  },
  success: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    avatar: "bg-emerald-600 text-white dark:bg-emerald-400 dark:text-slate-950",
  },
  danger: {
    badge: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
    avatar: "bg-rose-600 text-white dark:bg-rose-400 dark:text-slate-950",
  },
  warning: {
    badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    avatar: "bg-amber-500 text-white dark:bg-amber-300 dark:text-slate-950",
  },
};

function getInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) {
    return "SY";
  }
  return parts.map((part) => part[0]).join("").toUpperCase();
}

export function HistoryTimeline({ items, emptyMessage = "No history is available yet." }: HistoryTimelineProps) {
  if (!items.length) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const tone = toneStyles[item.tone];
        return (
          <div key={item.id} className="relative flex gap-4">
            {index < items.length - 1 ? (
              <span className="absolute left-[1.15rem] top-10 h-[calc(100%-1.25rem)] w-px bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
            ) : null}
            <div className={`relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${tone.avatar}`}>
              {getInitials(item.actorName)}
            </div>
            <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${tone.badge}`}>
                      {item.label}
                    </span>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.actorName}</p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(item.createdAt)}</p>
              </div>
              {item.statusText ? (
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.statusText}</p>
              ) : null}
              {item.body ? <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.body}</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
