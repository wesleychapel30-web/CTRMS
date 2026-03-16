import type { ReactNode } from "react";

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
  sort,
  onSortChange,
  pagination
}: DataTableProps<T>) {
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.count / pagination.pageSize)) : 1;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <tr>
              {columns.map((column) => (
                <th key={column.label} className="px-4 py-3 font-semibold">
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
                      <span className="text-xs opacity-70">
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
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {!rows.length ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
            {rows.map((row, index) => (
              <tr key={index} className="transition hover:bg-slate-50 dark:hover:bg-slate-900">
                {columns.map((column) => (
                  <td key={column.label} className="px-4 py-3.5 text-slate-700 dark:text-slate-200">
                    {column.render ? column.render(row) : String(row[column.key as keyof T] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <span>
            Page <strong className="text-slate-900 dark:text-slate-100">{pagination.page}</strong> of{" "}
            <strong className="text-slate-900 dark:text-slate-100">{totalPages}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-50 dark:border-slate-700"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(Math.min(totalPages, pagination.page + 1))}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-900"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
