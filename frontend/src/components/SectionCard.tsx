import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function SectionCard({ title, subtitle, action, children }: SectionCardProps) {
  return (
    <section className="surface-panel rounded-xl p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="headline-font text-lg font-bold tracking-[-0.03em] text-[var(--ink)]">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm font-medium text-[var(--muted)]">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
