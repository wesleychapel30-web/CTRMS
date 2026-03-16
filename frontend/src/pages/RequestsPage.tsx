import { Funnel, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FilterBar } from "../components/FilterBar";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { useSession } from "../context/SessionContext";
import { buildApiUrl, fetchRequests } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import type { RequestRecord } from "../types";

export function RequestsPage() {
  const { hasPermission } = useSession();
  const [rows, setRows] = useState<RequestRecord[]>([]);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("-created_at");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) {
      params.set("search", search);
    }
    if (status) {
      params.set("status", status);
    }
    if (category) {
      params.set("category", category);
    }
    params.set("page", String(page));
    params.set("ordering", ordering);

    fetchRequests(params)
      .then((response) => {
        setRows(response.results);
        setCount(response.count);
      })
      .catch((reason) => setError(reason.message));
  }, [search, status, category, page, ordering]);

  useEffect(() => {
    setPage(1);
  }, [search, status, category]);

  const categoryOptions = useMemo(() => {
    const values = new Set(rows.map((row) => row.category));
    return Array.from(values);
  }, [rows]);

  const sort = ordering
    ? {
        key: ordering.startsWith("-") ? ordering.slice(1) : ordering,
        direction: ordering.startsWith("-") ? ("desc" as const) : ("asc" as const)
      }
    : null;

  const exportParams = new URLSearchParams();
  if (search) exportParams.set("search", search);
  if (status) exportParams.set("status", status);
  if (category) exportParams.set("category", category);
  const exportSuffix = exportParams.toString() ? `?${exportParams.toString()}` : "";
  const excelExportUrl = buildApiUrl(`/export/requests-excel/${exportSuffix}`);
  const pdfExportUrl = buildApiUrl(`/export/requests-pdf/${exportSuffix}`);
  const canExport = hasPermission("report:export");

  return (
    <div className="space-y-6">
      <SectionCard
        title="Requests"
        subtitle="Request list and status."
        action={canExport ? (
          <div className="flex gap-2">
            <a href={excelExportUrl} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
              Export Excel
            </a>
            <a href={pdfExportUrl} className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white dark:bg-blue-500">
              Export PDF
            </a>
          </div>
        ) : undefined}
      >
        <FilterBar>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent outline-none" placeholder="Search by applicant or request ID" />
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <Funnel className="h-4 w-4" />
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full bg-transparent outline-none">
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="pending">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid / Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <Funnel className="h-4 w-4" />
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full bg-transparent outline-none">
              <option value="">All categories</option>
              {categoryOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Showing {rows.length} request{rows.length === 1 ? "" : "s"}
          </div>
        </FilterBar>

        {error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : (
          <DataTable
            columns={[
              { key: "request_id", label: "Request ID", sortable: true, sortKey: "request_id", render: (row) => <span className="font-semibold">{row.request_id}</span> },
              { key: "created_at", label: "Date Received", sortable: true, sortKey: "created_at", render: (row) => formatDate(row.created_at) },
              { key: "applicant_name", label: "Applicant Name", sortable: true, sortKey: "applicant_name" },
              { key: "category_display", label: "Category", sortable: true, sortKey: "category" },
              { key: "amount_requested", label: "Amount Requested", sortable: true, sortKey: "amount_requested", render: (row) => formatCurrency(row.amount_requested) },
              { key: "status_display", label: "Status", sortable: true, sortKey: "status", render: (row) => <StatusBadge status={row.status_display} /> },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <Link to={`/requests/${row.id}`} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-cyan-500 dark:text-slate-900">
                    View
                  </Link>
                )
              }
            ]}
            rows={rows}
            sort={sort}
            onSortChange={(next) => {
              if (!next) {
                setOrdering("-created_at");
                return;
              }
              setOrdering(`${next.direction === "desc" ? "-" : ""}${next.key}`);
              setPage(1);
            }}
            pagination={{
              page,
              pageSize: 20,
              count,
              onPageChange: (nextPage) => setPage(nextPage)
            }}
          />
        )}
      </SectionCard>
    </div>
  );
}
