import type { ReactNode } from "react";
import { TableSkeleton } from "./FeedbackStates";

type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  sortKey?: string;
};

type SortState = {
  key: string;
  direction: "asc" | "desc";
};

type DataTableProps<T> = {
  columns: Array<Column<T>>;
  rows: T[];
  emptyMessage?: string;
  isLoading?: boolean;
  loadingMessage?: string;
  loadingRowCount?: number;
  sort?: SortState | null;
  onSortChange?: (next: SortState | null) => void;
  pagination?: {
    page: number;
    pageSize: number;
    count: number;
    onPageChange: (page: number) => void;
  };
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyMessage = "No records found.",
  isLoading = false,
  loadingMessage = "Loading records...",
  loadingRowCount = 5,
  sort,
  onSortChange,
  pagination
}: DataTableProps<T>) {
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.count / pagination.pageSize)) : 1;

  if (isLoading) {
    return <TableSkeleton columns={columns.length} rows={loadingRowCount} message={loadingMessage} />;
  }

  return (
    <div className="surface-panel overflow-hidden rounded-xl">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--surface-low)] text-[var(--muted)]">
            <tr>
              {columns.map((column) => (
                <th key={column.label} className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.16em]">
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => {
                        const sortKey = column.sortKey ?? String(column.key);
                        if (!sort || sort.key !== sortKey) {
                          onSortChange({ key: sortKey, direction: "asc" });
                          return;
                        }
                        if (sort.direction === "asc") {
                          onSortChange({ key: sortKey, direction: "desc" });
                          return;
                        }
                        onSortChange(null);
                      }}
                      className="inline-flex items-center gap-2"
                    >
                      <span>{column.label}</span>
                      <span className="text-[10px] opacity-70">
                        {sort && sort.key === (column.sortKey ?? String(column.key))
                          ? sort.direction === "asc"
                            ? "▲"
                            : "▼"
                          : ""}
                      </span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-10 text-center text-sm text-[var(--muted)]">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
            {rows.map((row, index) => (
              <tr key={index} className="group transition hover:bg-[var(--surface-low)]/50">
                {columns.map((column) => (
                  <td key={column.label} className="px-6 py-4 text-[var(--ink)]">
                    {column.render ? column.render(row) : String(row[column.key as keyof T] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-low)] px-6 py-4 text-sm text-[var(--muted)]">
          <span>
            Page <strong className="text-[var(--ink)]">{pagination.page}</strong> of{" "}
            <strong className="text-[var(--ink)]">{totalPages}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))}
              className="rounded-sm bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(Math.min(totalPages, pagination.page + 1))}
              className="primary-button rounded-sm px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
