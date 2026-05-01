import type { Stat } from "../types";

const toneMap: Record<string, { shell: string; bar: string }> = {
  accent:  { shell: "surface-panel",                                               bar: "stat-bar-accent"  },
  success: { shell: "bg-[var(--status-success-bg)] shadow-[var(--shadow-ambient)]", bar: "stat-bar-success" },
  warning: { shell: "bg-[var(--status-warning-bg)] shadow-[var(--shadow-ambient)]", bar: "stat-bar-warning" },
  danger:  { shell: "bg-[var(--status-danger-bg)]  shadow-[var(--shadow-ambient)]", bar: "stat-bar-danger"  },
};

export function StatCard({ label, value, change, tone }: Stat) {
  const meta = toneMap[tone] ?? toneMap.accent;
  return (
    <article className={`interactive-lift relative overflow-hidden rounded-xl pb-4 pl-4 pr-4 pt-5 ${meta.shell}`}>
      <div className={`absolute inset-x-0 top-0 h-[3px] ${meta.bar}`} aria-hidden="true" />
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <div className="mt-3">
        <p className="headline-font text-2xl font-extrabold tracking-[-0.04em] text-[var(--ink)] sm:text-3xl">{value}</p>
        <p className="mt-1 truncate text-[11px] font-medium text-[var(--muted)]">{change}</p>
      </div>
    </article>
  );
}
