type WorkspaceTab<TKey extends string> = {
  key: TKey;
  label: string;
  badge?: string | number | null;
};

type WorkspaceTabsProps<TKey extends string> = {
  tabs: Array<WorkspaceTab<TKey>>;
  activeTab: TKey;
  onChange: (key: TKey) => void;
  className?: string;
};

export function WorkspaceTabs<TKey extends string>({
  tabs,
  activeTab,
  onChange,
  className = ""
}: WorkspaceTabsProps<TKey>) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
              isActive
                ? "bg-[var(--surface-card)] text-[var(--accent)] shadow-sm ring-1 ring-[var(--line)]"
                : "bg-[var(--surface-low)] text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null ? (
              <span
                className={`ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-card)] text-[var(--muted)]"
                }`}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
