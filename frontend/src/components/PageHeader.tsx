type PageHeaderProps = {
  title: string;
  subtitle?: string;
};

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="min-w-0">
      <h1 className="headline-font text-[1.95rem] font-extrabold tracking-[-0.04em] text-[var(--ink)]">{title}</h1>
      {subtitle ? <p className="mt-1 max-w-3xl text-sm font-medium text-[var(--muted)]">{subtitle}</p> : null}
    </div>
  );
}
