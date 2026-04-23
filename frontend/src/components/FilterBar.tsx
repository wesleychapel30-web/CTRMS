import type { ReactNode } from "react";

type FilterBarProps = {
  children: ReactNode;
  className?: string;
};

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={`mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface-card)] p-3 ${className ?? ""}`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
    </div>
  );
}
