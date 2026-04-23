type PageHeaderProps = {
  title: string;
  subtitle?: string;
};

export function PageHeader({ title }: PageHeaderProps) {
  return (
    <div className="min-w-0">
      <h1 className="headline-font text-2xl font-extrabold tracking-[-0.03em] text-[var(--ink)] sm:text-[1.75rem]">
        {title}
      </h1>
    </div>
  );
}
