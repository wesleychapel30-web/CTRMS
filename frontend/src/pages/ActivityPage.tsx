import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { SectionCard } from "../components/SectionCard";
import { useSession } from "../context/SessionContext";
import { fetchActivityLogs } from "../lib/api";
import { formatDateTime, sentenceCase } from "../lib/format";
import type { ActivityLogRecord } from "../types";

export function ActivityPage() {
  const { hasPermission } = useSession();
  const [logs, setLogs] = useState<ActivityLogRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canViewAudit = hasPermission("audit:view");

  useEffect(() => {
    if (!canViewAudit) {
      return;
    }
    fetchActivityLogs()
      .then((data) => setLogs(data.logs))
      .catch((reason) => setError(reason.message));
  }, [canViewAudit]);

  if (!canViewAudit) {
    return (
      <SectionCard title="Activity Logs">
        You do not have permission to view activity logs.
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Activity Logs" subtitle="System audit trail.">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <DataTable
        columns={[
          { key: "user", label: "User" },
          {
            key: "action",
            label: "Action",
            render: (row) => (
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{row.message ?? `${sentenceCase(row.action_label)} on ${row.content_type}`}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{row.description || "No description"}</p>
              </div>
            )
          },
          { key: "content_type", label: "Record" },
          { key: "created_at", label: "Timestamp", render: (row) => formatDateTime(row.created_at) }
        ]}
        rows={logs}
        emptyMessage="No activity logs available."
      />
    </SectionCard>
  );
}
