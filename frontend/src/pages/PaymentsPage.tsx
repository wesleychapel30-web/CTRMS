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

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Unable to load payments";
}

export function PaymentsPage() {
  const { hasAnyPermission } = useSession();
  const [rows, setRows] = useState<RequestRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<PaymentFilter>("all");
  const canView = hasAnyPermission(["payment:view", "payment:record"]);

  useEffect(() => {
    if (!canView) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchRequests()
      .then((response) => {
        setRows(response.results.filter((item) => ["approved", "partially_paid", "paid"].includes(item.status)));
        setError(null);
      })
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setIsLoading(false));
  }, [canView]);

  const filteredRows = useMemo(() => {
    if (activeFilter === "paid") {
      return rows.filter((item) => item.status === "paid");
    }
    if (activeFilter === "partial") {
      return rows.filter((item) => item.status === "partially_paid");
    }
    if (activeFilter === "pending") {
      return rows.filter((item) => item.status === "approved");
    }
    return rows;
  }, [activeFilter, rows]);

  const totalDisbursed = rows.reduce((sum, item) => sum + Number(item.disbursed_amount ?? 0), 0);
  const pendingSettlements = rows
    .filter((item) => item.status === "approved")
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
    <div className="space-y-8">
      <section className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Payments & Disbursement</p>
            <h2 className="headline-font mt-3 text-4xl font-extrabold tracking-[-0.06em] text-[var(--ink)]">
              Institutional financial tracking
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              Monitor approved disbursements, settlement progress, and outstanding payment balances tied to request approvals.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/reports" className="secondary-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold">
              <Download className="h-4 w-4" />
              Export Ledger
            </Link>
            <Link to="/requests" className="primary-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold">
              Record Payment
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="surface-panel rounded-xl px-6 py-5">
            <p className="section-kicker">Total Disbursed</p>
            <p className="headline-font mt-3 text-3xl font-extrabold tracking-[-0.05em]">{formatCurrency(totalDisbursed)}</p>
            <p className="mt-2 text-xs font-semibold text-[var(--success)]">Approved payments processed</p>
          </div>
          <div className="surface-panel rounded-xl px-6 py-5">
            <p className="section-kicker">Pending Settlements</p>
            <p className="headline-font mt-3 text-3xl font-extrabold tracking-[-0.05em]">{formatCurrency(pendingSettlements)}</p>
            <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
              {rows.filter((item) => item.status === "approved").length} requests awaiting entry
            </p>
          </div>
          <div className="surface-panel rounded-xl px-6 py-5">
            <p className="section-kicker">Avg. Processing Time</p>
            <p className="headline-font mt-3 text-3xl font-extrabold tracking-[-0.05em]">{averageProcessingDays} days</p>
            <p className="mt-2 text-xs font-semibold text-[var(--danger)]">Measured from approval to payment date</p>
          </div>
          <div className="surface-panel rounded-xl px-6 py-5">
            <p className="section-kicker">Capital Reserve</p>
            <p className="headline-font mt-3 text-3xl font-extrabold tracking-[-0.05em]">{capitalReserve}%</p>
            <div className="mt-3 h-2 rounded-full bg-[var(--surface-container)]">
              <div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${capitalReserve}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="surface-panel overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--surface-low)] px-6 py-4">
          <div className="flex flex-wrap gap-2">
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
                className={`rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] ${
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
            <button type="button" className="secondary-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold">
              <Filter className="h-4 w-4" />
              Filter
            </button>
            <button type="button" className="secondary-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold">
              <SlidersHorizontal className="h-4 w-4" />
              Sort
            </button>
          </div>
        </div>

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
                <span className="h-full bg-[#8fa1bd]" style={{ width: "30%" }} />
                <span className="h-full bg-[#b4c3db]" style={{ width: "25%" }} />
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
