import type { Stat } from "../types";

const toneMap: Record<string, { shell: string; bar: string }> = {
  accent:  { shell: "surface-panel",                                              bar: "bg-[var(--accent)]"  },
  success: { shell: "bg-[var(--status-success-bg)] shadow-[var(--shadow-ambient)]", bar: "bg-[var(--success)]"  },
  warning: { shell: "bg-[var(--status-warning-bg)] shadow-[var(--shadow-ambient)]", bar: "bg-[var(--warning)]"  },
  danger:  { shell: "bg-[var(--status-danger-bg)]  shadow-[var(--shadow-ambient)]", bar: "bg-[var(--danger)]"   },
};

export function StatCard({ label, value, change, tone }: Stat) {
  const meta = toneMap[tone] ?? toneMap.accent;
  return (
    <article className={`interactive-lift relative overflow-hidden rounded-xl px-4 py-3 ${meta.shell}`}>
      <div className={`absolute left-0 top-0 h-full w-0.5 rounded-l-xl ${meta.bar}`} aria-hidden="true" />
      <p className="pl-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <div className="mt-2 pl-2">
        <p className="headline-font text-2xl font-extrabold tracking-[-0.04em] text-[var(--ink)]">{value}</p>
        <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--muted)]">{change}</p>
      </div>
    </article>
  );
}
