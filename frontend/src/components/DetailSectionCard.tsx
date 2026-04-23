import type { ReactNode } from "react";

type DetailSectionCardProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  testId?: string;
};

export function DetailSectionCard({ title, subtitle, action, children, testId }: DetailSectionCardProps) {
  return (
    <section data-testid={testId} className="surface-panel item-enter rounded-xl p-4">
      <header className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2.5">
        <div className="min-w-0">
          <h3 className="headline-font text-sm font-bold tracking-[-0.02em] text-[var(--ink)]">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
