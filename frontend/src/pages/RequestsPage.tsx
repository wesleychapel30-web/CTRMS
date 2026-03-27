import { Funnel, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { InlineBanner } from "../components/FeedbackStates";
import { FilterBar } from "../components/FilterBar";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { useSession } from "../context/SessionContext";
import { buildApiUrl, fetchRequests } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import type { RequestRecord } from "../types";

const requestCategoryOptions = [
  { value: "tuition", label: "Tuition" },
  { value: "medical", label: "Medical Support" },
  { value: "construction", label: "Construction Aid" },
  { value: "event_sponsorship", label: "Event Sponsorship" },
  { value: "other", label: "Other" }
] as const;

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
  const [isLoading, setIsLoading] = useState(true);

  const loadRequests = () => {
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

    setIsLoading(true);
    setError(null);
    void fetchRequests(params)
      .then((response) => {
        setRows(response.results);
        setCount(response.count);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load requests"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadRequests();
  }, [search, status, category, page, ordering]);

  useEffect(() => {
    setPage(1);
  }, [search, status, category]);

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
        title="Requests Management"
        subtitle="Monitor request lifecycles from draft through completion."
        action={canExport ? (
          <div className="flex gap-2">
            <a href={excelExportUrl} className="rounded-sm bg-[var(--surface-low)] px-4 py-2 text-sm font-semibold text-[var(--ink)]">
              Export Excel
            </a>
            <a href={pdfExportUrl} className="primary-button rounded-sm px-4 py-2 text-sm font-semibold">
              Export PDF
            </a>
          </div>
        ) : undefined}
      >
        <FilterBar className="rounded-lg bg-[var(--surface-low)] p-5">
          <label className="flex min-w-[16rem] items-center gap-2 rounded-sm bg-[var(--surface-card)] px-3 py-2.5 text-sm text-[var(--muted)]">
            <Search className="h-4 w-4 text-[var(--muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent outline-none placeholder:text-[var(--muted)]"
              placeholder="Search by applicant or request ID"
            />
          </label>
          <label className="inline-flex items-center gap-2 rounded-sm bg-[var(--surface-card)] px-3 py-2.5 text-sm text-[var(--ink)]">
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
          <label className="inline-flex items-center gap-2 rounded-sm bg-[var(--surface-card)] px-3 py-2.5 text-sm text-[var(--ink)]">
            <Funnel className="h-4 w-4" />
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full bg-transparent outline-none">
              <option value="">All categories</option>
              {requestCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="ml-auto rounded-sm bg-transparent px-1 py-2 text-sm font-medium text-[var(--muted)]">
            Showing {rows.length} request{rows.length === 1 ? "" : "s"}
          </div>
        </FilterBar>

        {error ? <InlineBanner variant="error" title="Requests unavailable" message={error} actionLabel="Retry" onAction={loadRequests} /> : null}

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
          isLoading={isLoading}
          loadingMessage="Loading request records..."
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
      </SectionCard>
    </div>
  );
}
