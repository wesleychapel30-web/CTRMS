import type { ReactNode } from "react";

type DetailSectionCardProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function DetailSectionCard({ title, subtitle, action, children }: DetailSectionCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <header className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
