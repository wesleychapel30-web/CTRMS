import type { Stat } from "../types";

const toneMap = {
  accent: "surface-panel text-[var(--ink)]",
  success: "bg-[#edf8f2] text-[var(--ink)]",
  warning: "bg-[#fff5e6] text-[var(--ink)]",
  danger: "bg-[#fdf0ef] text-[var(--ink)]"
};

export function StatCard({ label, value, change, tone }: Stat) {
  return (
    <article className={`rounded-xl p-5 ${toneMap[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <div className="mt-3">
        <p className="headline-font text-3xl font-extrabold tracking-[-0.04em] text-[var(--ink)]">{value}</p>
        <p className="mt-1 text-xs font-medium text-[var(--muted)]">{change}</p>
      </div>
    </article>
  );
}
