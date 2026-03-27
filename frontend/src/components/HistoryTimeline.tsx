import { formatDateTime } from "../lib/format";
import type { HistoryTimelineEntry, HistoryTimelineTone } from "../lib/historyTimeline";

type HistoryTimelineProps = {
  items: HistoryTimelineEntry[];
  emptyMessage?: string;
};

const toneStyles: Record<HistoryTimelineTone, { badge: string; avatar: string }> = {
  neutral: {
    badge: "bg-[var(--surface-high)] text-[var(--muted)]",
    avatar: "bg-[var(--surface-highest)] text-[var(--ink)]",
  },
  info: {
    badge: "bg-[#d5e3fc] text-[#455367]",
    avatar: "bg-[#d5e3fc] text-[#455367]",
  },
  success: {
    badge: "bg-[#d7f3e4] text-[#1b6c4f]",
    avatar: "bg-[#d7f3e4] text-[#1b6c4f]",
  },
  danger: {
    badge: "bg-[#fe8983]/20 text-[#752121]",
    avatar: "bg-[#fe8983]/20 text-[#752121]",
  },
  warning: {
    badge: "bg-[#fff5e6] text-[var(--warning)]",
    avatar: "bg-[#fff5e6] text-[var(--warning)]",
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
    return <p className="text-sm text-[var(--muted)]">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-6">
      {items.map((item, index) => {
        const tone = toneStyles[item.tone];
        return (
          <div key={item.id} className="relative flex gap-4">
            {index < items.length - 1 ? (
              <span className="absolute left-[0.9rem] top-9 h-[calc(100%-0.5rem)] w-px bg-[var(--surface-container)]" aria-hidden="true" />
            ) : null}
            <div className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${tone.avatar}`}>
              {getInitials(item.actorName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${tone.badge}`}>
                      {item.label}
                    </span>
                    <p className="text-sm font-semibold text-[var(--ink)]">{item.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.actorName}</p>
                </div>
                <p className="text-[11px] font-medium text-[var(--muted)]">{formatDateTime(item.createdAt)}</p>
              </div>
              {item.statusText ? (
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{item.statusText}</p>
              ) : null}
              {item.body ? (
                <div className="mt-3 max-w-xl bg-[var(--surface-low)] p-3 text-sm italic leading-6 text-[var(--muted)]">
                  {item.body}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
