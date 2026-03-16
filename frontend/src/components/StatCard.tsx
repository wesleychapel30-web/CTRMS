import type { Stat } from "../types";

const toneMap = {
  accent: "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
  success: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20",
  danger: "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20"
};

export function StatCard({ label, value, change, tone }: Stat) {
  return (
    <article className={`rounded-xl border p-4 shadow-sm ${toneMap[tone]}`}>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
      <div className="mt-3">
        <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{change}</p>
      </div>
    </article>
  );
}
