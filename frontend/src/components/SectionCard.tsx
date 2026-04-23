import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  testId?: string;
  animate?: boolean;
};

export function SectionCard({ title, subtitle, action, children, testId, animate = true }: SectionCardProps) {
  return (
    <section
      data-testid={testId}
      className={`surface-panel interactive-lift rounded-xl p-4 ${animate ? "item-enter" : ""}`}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="headline-font text-sm font-bold tracking-[-0.02em] text-[var(--ink)]">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
