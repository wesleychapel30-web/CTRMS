type PageHeaderProps = {
  title: string;
  subtitle?: string;
};

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-900 dark:text-slate-100">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p> : null}
    </div>
  );
}
