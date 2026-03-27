import type { ReactNode } from "react";

type DetailSectionCardProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function DetailSectionCard({ title, subtitle, action, children }: DetailSectionCardProps) {
  return (
    <section className="surface-panel rounded-xl p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">{title}</h3>
          {subtitle ? <p className="mt-2 text-sm font-medium text-[var(--muted)]">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
