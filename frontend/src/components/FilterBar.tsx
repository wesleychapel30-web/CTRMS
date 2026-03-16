import type { ReactNode } from "react";

type FilterBarProps = {
  children: ReactNode;
  className?: string;
};

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={`mb-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950 ${className ?? ""}`}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </div>
  );
}
