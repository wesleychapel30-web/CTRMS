type PageHeaderProps = {
  title: string;
  subtitle?: string;
};

export function PageHeader({ title }: PageHeaderProps) {
  return (
    <div className="min-w-0">
      <h1 className="headline-font truncate text-xl font-extrabold tracking-[-0.03em] text-[var(--ink)] sm:text-2xl">
        {title}
      </h1>
    </div>
  );
}
