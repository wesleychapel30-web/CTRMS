type StatusBadgeProps = {
  status: string;
};

const statusMap: Record<string, string> = {
  draft: "bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  pending: "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  under_review: "bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  approved: "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  rejected: "bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  partially_paid: "bg-cyan-100 text-cyan-800 border border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30",
  paid: "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  cancelled: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  archived: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  pending_review: "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  accepted: "bg-cyan-100 text-cyan-800 border border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30",
  declined: "bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  confirmed_attendance: "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  completed: "bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30"
};

function normalizeStatus(status: string) {
  return status.toLowerCase().replace(/\s+\/\s+/g, "_").replace(/\s+/g, "_");
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = normalizeStatus(status);
  return (
    <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${statusMap[normalized] ?? "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"}`}>
      {status}
    </span>
  );
}
