import { formatDateTime } from "../lib/format";
import type { HistoryTimelineEntry, HistoryTimelineTone } from "../lib/historyTimeline";

type HistoryTimelineProps = {
  items: HistoryTimelineEntry[];
  emptyMessage?: string;
};

type ToneStyle = { badgeBg: string; badgeText: string; avatarBg: string; avatarText: string };

const toneStyles: Record<HistoryTimelineTone, ToneStyle> = {
  neutral: {
    badgeBg:    "var(--status-neutral-bg)",
    badgeText:  "var(--status-neutral-text)",
    avatarBg:   "var(--surface-highest)",
    avatarText: "var(--ink)",
  },
  info: {
    badgeBg:    "var(--status-info-bg)",
    badgeText:  "var(--status-info-text)",
    avatarBg:   "var(--status-info-bg)",
    avatarText: "var(--status-info-text)",
  },
  success: {
    badgeBg:    "var(--status-success-bg)",
    badgeText:  "var(--status-success-text)",
    avatarBg:   "var(--status-success-bg)",
    avatarText: "var(--status-success-text)",
  },
  danger: {
    badgeBg:    "var(--status-danger-bg)",
    badgeText:  "var(--status-danger-text)",
    avatarBg:   "var(--status-danger-bg)",
    avatarText: "var(--status-danger-text)",
  },
  warning: {
    badgeBg:    "var(--status-warning-bg)",
    badgeText:  "var(--status-warning-text)",
    avatarBg:   "var(--status-warning-bg)",
    avatarText: "var(--status-warning-text)",
  },
};

function getInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "SY";
  return parts.map((part) => part[0]).join("").toUpperCase();
}

export function HistoryTimeline({ items, emptyMessage = "No history is available yet." }: HistoryTimelineProps) {
  if (!items.length) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--surface-container)] px-4 py-4 text-sm text-[var(--muted)]">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {items.map((item, index) => {
        const tone = toneStyles[item.tone];
        return (
          <div key={item.id} className="item-enter relative flex gap-4" style={{ animationDelay: `${index * 40}ms` }}>
            {index < items.length - 1 ? (
              <span
                className="absolute left-[0.9rem] top-9 h-[calc(100%-0.5rem)] w-px bg-[var(--surface-container)]"
                aria-hidden="true"
              />
            ) : null}
            <div
              className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors"
              style={{ background: tone.avatarBg, color: tone.avatarText }}
            >
              {getInitials(item.actorName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors"
                      style={{ background: tone.badgeBg, color: tone.badgeText }}
                    >
                      {item.label}
                    </span>
                    <p className="text-sm font-semibold text-[var(--ink)]">{item.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.actorName}</p>
                </div>
                <p className="text-[11px] font-medium text-[var(--muted)]">{formatDateTime(item.createdAt)}</p>
              </div>
              {item.statusText ? (
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                  {item.statusText}
                </p>
              ) : null}
              {item.body ? (
                <div className="mt-3 max-w-xl rounded-xl border border-[var(--surface-container)] bg-[var(--surface-low)] px-4 py-3 text-sm leading-6 text-[var(--ink)]">
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
