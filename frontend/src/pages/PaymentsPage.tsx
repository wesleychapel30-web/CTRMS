import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { useSession } from "../context/SessionContext";
import { fetchRequests } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import { getPaymentLifecycleState, getRequestActionVisibility } from "../lib/workflowMatrix";
import type { RequestRecord } from "../types";

export function PaymentsPage() {
  const { hasAnyPermission } = useSession();
  const [rows, setRows] = useState<RequestRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canView = hasAnyPermission(["payment:view", "payment:record"]);

  useEffect(() => {
    if (!canView) {
      return;
    }
    fetchRequests()
      .then((response) =>
        setRows(response.results.filter((item) => ["approved", "partially_paid", "paid"].includes(item.status)))
      )
      .catch((reason) => setError(reason.message));
  }, [canView]);

  if (!canView) {
    return <SectionCard title="Payments">You do not have permission to view payments.</SectionCard>;
  }

  return (
    <SectionCard title="Payments" subtitle="Approved requests and disbursements.">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <DataTable
        columns={[
          { key: "request_id", label: "Request ID" },
          { key: "applicant_name", label: "Applicant" },
          { key: "approved_amount", label: "Approved", render: (row) => formatCurrency(row.approved_amount) },
          { key: "disbursed_amount", label: "Disbursed", render: (row) => formatCurrency(row.disbursed_amount) },
          { key: "payment_date", label: "Payment Date", render: (row) => formatDate(row.payment_date) },
          { key: "payment_reference", label: "Reference" },
          { key: "status_display", label: "Status", render: (row) => <StatusBadge status={row.status_display} /> },
          { key: "payment_state", label: "Payment State", render: (row) => getPaymentLifecycleState(row) },
          {
            key: "actions",
            label: "Actions",
            render: (row) => {
              const visibility = getRequestActionVisibility(row.status);
              const actionLabel = visibility.showRecordPayment
                ? "Record Payment"
                : visibility.showAddPayment || visibility.showMarkCompleted
                  ? "Manage Payments"
                  : "View";

              return (
                <Link to={`/requests/${row.id}`} className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-blue-500">
                  {actionLabel}
                </Link>
              );
            }
          }
        ]}
        rows={rows}
      />
    </SectionCard>
  );
}
