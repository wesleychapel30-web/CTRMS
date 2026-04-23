import { Download, Filter, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { InlineBanner, StatePanel } from "../components/FeedbackStates";
import { StatusBadge } from "../components/StatusBadge";
import { useSession } from "../context/SessionContext";
import { fetchRequests } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import { getPaymentLifecycleState, getRequestActionVisibility } from "../lib/workflowMatrix";
import type { RequestRecord } from "../types";

type PaymentFilter = "all" | "paid" | "partial" | "pending";
type PaymentSort = "recent" | "approved_desc" | "disbursed_desc" | "balance_desc";

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Unable to load payments";
}

export function PaymentsPage() {
  const { hasAnyPermission } = useSession();
  const [rows, setRows] = useState<RequestRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<PaymentFilter>("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortMode, setSortMode] = useState<PaymentSort>("recent");
  const canView = hasAnyPermission(["payment:view", "payment:record"]);

  useEffect(() => {
    if (!canView) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchRequests()
      .then((response) => {
        setRows(response.results.filter((item) =>
          ["director_approved", "finance_processing", "finance_query", "pending_payment", "approved", "partially_paid", "paid"].includes(item.status)
        ));
        setError(null);
      })
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setIsLoading(false));
  }, [canView]);

  const filteredRows = useMemo(() => {
    let nextRows = rows.filter((item) => {
      if (activeFilter === "paid" && item.status !== "paid") {
        return false;
      }
      if (activeFilter === "partial" && item.status !== "partially_paid") {
        return false;
      }
      if (activeFilter === "pending" && !["director_approved", "finance_processing", "finance_query", "pending_payment", "approved"].includes(item.status)) {
        return false;
      }
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      const referenceDate = (item.payment_date || item.reviewed_at || item.created_at).slice(0, 10);
      if (fromDate && referenceDate < fromDate) {
        return false;
      }
      if (toDate && referenceDate > toDate) {
        return false;
      }
      return true;
    });

    nextRows = [...nextRows].sort((left, right) => {
      if (sortMode === "approved_desc") {
        return Number(right.approved_amount ?? 0) - Number(left.approved_amount ?? 0);
      }
      if (sortMode === "disbursed_desc") {
        return Number(right.disbursed_amount ?? 0) - Number(left.disbursed_amount ?? 0);
      }
      if (sortMode === "balance_desc") {
        return Number(right.remaining_balance ?? 0) - Number(left.remaining_balance ?? 0);
      }
      const leftDate = new Date(left.payment_date || left.reviewed_at || left.created_at).getTime();
      const rightDate = new Date(right.payment_date || right.reviewed_at || right.created_at).getTime();
      return rightDate - leftDate;
    });

    return nextRows;
  }, [activeFilter, categoryFilter, fromDate, rows, sortMode, toDate]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(rows.map((item) => item.category).filter(Boolean))).sort(),
    [rows]
  );
  const sortLabel =
    sortMode === "approved_desc"
      ? "Approved Amount"
      : sortMode === "disbursed_desc"
        ? "Paid to Date"
        : sortMode === "balance_desc"
          ? "Remaining Balance"
          : "Latest Activity";

  const cycleSortMode = () => {
    setSortMode((current) => {
      if (current === "recent") return "approved_desc";
      if (current === "approved_desc") return "disbursed_desc";
      if (current === "disbursed_desc") return "balance_desc";
      return "recent";
    });
  };

  const totalDisbursed = rows.reduce((sum, item) => sum + Number(item.disbursed_amount ?? 0), 0);
  const pendingSettlements = rows
    .filter((item) => ["director_approved", "finance_processing", "finance_query", "pending_payment", "approved"].includes(item.status))
    .reduce((sum, item) => sum + Math.max(Number(item.approved_amount ?? 0) - Number(item.disbursed_amount ?? 0), 0), 0);
  const averageProcessingDays = rows.length
    ? (
        rows.reduce((sum, item) => {
          if (!item.reviewed_at || !item.payment_date) {
            return sum;
          }
          const start = new Date(item.reviewed_at).getTime();
          const end = new Date(item.payment_date).getTime();
          return sum + Math.max((end - start) / (1000 * 60 * 60 * 24), 0);
        }, 0) / rows.filter((item) => item.reviewed_at && item.payment_date).length || 0
      ).toFixed(1)
    : "0.0";
  const capitalReserve = rows.length
    ? Math.round((rows.filter((item) => item.status !== "paid").length / rows.length) * 100)
    : 0;

  if (!canView) {
    return <StatePanel variant="info" title="Payments restricted" message="You do not have permission to view payment records." />;
  }

  return (
    <div className="space-y-4">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="headline-font text-xl font-extrabold tracking-[-0.04em] text-[var(--ink)]">
            Payments
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link to="/reports" className="secondary-button inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold">
              <Download className="h-3.5 w-3.5" />
              Export Ledger
            </Link>
            <Link to="/requests" className="primary-button inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold">
              Record Payment
            </Link>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="item-enter item-enter-1 surface-panel rounded-xl px-4 py-3">
            <p className="section-kicker">Total Disbursed</p>
            <p className="headline-font mt-2 text-2xl font-extrabold tracking-[-0.05em]">{formatCurrency(totalDisbursed)}</p>
            <p className="mt-1 text-xs font-semibold text-[var(--success)]">Approved payments processed</p>
          </div>
          <div className="item-enter item-enter-2 surface-panel rounded-xl px-4 py-3">
            <p className="section-kicker">Pending Settlements</p>
            <p className="headline-font mt-2 text-2xl font-extrabold tracking-[-0.05em]">{formatCurrency(pendingSettlements)}</p>
            <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
              {rows.filter((item) => item.status === "approved").length} requests awaiting entry
            </p>
          </div>
          <div className="item-enter item-enter-3 surface-panel rounded-xl px-4 py-3">
            <p className="section-kicker">Avg. Processing Time</p>
            <p className="headline-font mt-2 text-2xl font-extrabold tracking-[-0.05em]">{averageProcessingDays} days</p>
            <p className="mt-1 text-xs font-semibold text-[var(--danger)]">Measured from approval to payment date</p>
          </div>
          <div className="item-enter item-enter-4 surface-panel rounded-xl px-4 py-3">
            <p className="section-kicker">Capital Reserve</p>
            <p className="headline-font mt-2 text-2xl font-extrabold tracking-[-0.05em]">{capitalReserve}%</p>
            <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-container)]">
              <div className="h-1.5 rounded-full bg-[var(--accent)]" style={{ width: `${capitalReserve}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="surface-panel overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-low)] px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: "all", label: "All Disbursements" },
              { key: "pending", label: "Pending Entry" },
              { key: "partial", label: "Partially Paid" },
              { key: "paid", label: "Fully Paid" }
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveFilter(item.key as PaymentFilter)}
                className={`rounded-sm px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] ${
                  activeFilter === item.key
                    ? "bg-[var(--surface-card)] text-[var(--accent)] shadow-sm"
                    : "text-[var(--muted)]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((current) => !current)}
              className="secondary-button inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold"
            >
              <Filter className="h-3.5 w-3.5" />
              {showAdvancedFilters ? "Hide Filters" : "Filter"}
            </button>
            <button
              type="button"
              onClick={cycleSortMode}
              className="secondary-button inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Sort: {sortLabel}
            </button>
          </div>
        </div>

        {showAdvancedFilters ? (
          <div className="grid gap-2 border-t border-[var(--line)] bg-[var(--surface-card)] px-4 py-3 md:grid-cols-4">
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="institutional-input rounded-md px-3 py-2 text-sm outline-none"
            >
              <option value="all">All categories</option>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="institutional-input rounded-md px-3 py-2 text-sm outline-none" />
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="institutional-input rounded-md px-3 py-2 text-sm outline-none" />
            <button
              type="button"
              onClick={() => {
                setCategoryFilter("all");
                setFromDate("");
                setToDate("");
              }}
              className="secondary-button rounded-md px-3 py-2 text-xs font-semibold"
            >
              Clear Filters
            </button>
          </div>
        ) : null}

        {error ? <InlineBanner variant="error" title="Payments unavailable" message={error} className="mx-6 mt-5" /> : null}

        <DataTable
          columns={[
            {
              key: "request_id",
              label: "Request ID",
              render: (row) => (
                <div>
                  <p className="font-mono text-xs font-semibold text-[var(--accent)]">{row.request_id}</p>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">{row.title}</p>
                </div>
              )
            },
            { key: "approved_amount", label: "Total Approved", render: (row) => formatCurrency(row.approved_amount) },
            { key: "disbursed_amount", label: "Paid to Date", render: (row) => formatCurrency(row.disbursed_amount) },
            { key: "remaining_balance", label: "Remaining Balance", render: (row) => formatCurrency(row.remaining_balance) },
            { key: "payment_date", label: "Last Payment Date", render: (row) => formatDate(row.payment_date) },
            { key: "status_display", label: "Status", render: (row) => <StatusBadge status={row.status_display} /> },
            { key: "payment_state", label: "Payment State", render: (row) => getPaymentLifecycleState(row) },
            {
              key: "actions",
              label: "Actions",
              render: (row) => {
                const visibility = getRequestActionVisibility(row.status);
                const actionLabel = visibility.showRecordPayment
                  ? "Record"
                  : visibility.showAddPayment || visibility.showMarkCompleted
                    ? "Manage"
                    : "View";

                return (
                  <Link to={`/requests/${row.id}`} className="secondary-button inline-flex rounded-md px-3 py-1.5 text-xs font-semibold">
                    {actionLabel}
                  </Link>
                );
              }
            }
          ]}
          rows={filteredRows}
          density="compact"
          isLoading={isLoading}
          loadingMessage="Loading payment records..."
          emptyMessage="No payment records available for this view."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="hero-card rounded-xl p-6">
          <p className="section-kicker">Liquidity Distribution</p>
          <div className="mt-6 space-y-4">
            <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-container)]">
              <div className="flex h-full w-full">
                <span className="h-full bg-[var(--accent)]" style={{ width: "45%" }} />
                <span className="h-full bg-[var(--accent-dim)]" style={{ width: "30%" }} />
                <span className="h-full bg-[var(--surface-highest)]" style={{ width: "25%" }} />
              </div>
            </div>
            <div className="flex flex-wrap gap-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              <span>Infrastructure (45%)</span>
              <span>Operations (30%)</span>
              <span>Reserve (25%)</span>
            </div>
          </div>
        </div>

        <div className="surface-panel rounded-xl p-6">
          <p className="section-kicker">Settlement Note</p>
          <h3 className="headline-font mt-3 text-xl font-bold tracking-[-0.04em] text-[var(--ink)]">Automatic settlement monitoring</h3>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            Approved requests stay visible here until they are fully settled. Partial disbursements and payment completion continue through the existing request workflow.
          </p>
        </div>
      </section>
    </div>
  );
}
