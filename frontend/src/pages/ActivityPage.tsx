import { Download, Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "../components/DataTable";
import { InlineBanner, StatePanel } from "../components/FeedbackStates";
import { useSession } from "../context/SessionContext";
import { fetchActivityLogs } from "../lib/api";
import { formatDateTime, sentenceCase } from "../lib/format";
import type { ActivityLogRecord } from "../types";

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Unable to load activity logs";
}

function downloadCsv(rows: ActivityLogRecord[]) {
  const header = ["Timestamp", "User", "Action", "Record", "Details"];
  const data = rows.map((row) => [
    row.created_at,
    row.user,
    row.message ?? `${sentenceCase(row.action_label)} on ${row.content_type}`,
    row.content_type,
    row.description
  ]);

  const csv = [header, ...data]
    .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "activity-logs.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ActivityPage() {
  const { hasPermission } = useSession();
  const [logs, setLogs] = useState<ActivityLogRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const canViewAudit = hasPermission("audit:view");

  useEffect(() => {
    if (!canViewAudit) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchActivityLogs()
      .then((data) => {
        setLogs(data.logs);
        setError(null);
      })
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setIsLoading(false));
  }, [canViewAudit]);

  const filteredLogs = useMemo(() => {
    return logs.filter((row) => {
      const haystack = `${row.user} ${row.action_label} ${row.content_type} ${row.description} ${row.message ?? ""}`.toLowerCase();
      const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
      const matchesAction = actionFilter === "all" || row.action_label === actionFilter;
      return matchesQuery && matchesAction;
    });
  }, [actionFilter, logs, query]);

  const uniqueUsers = new Set(filteredLogs.map((row) => row.user)).size;
  const flaggedEvents = filteredLogs.filter((row) => /denied|rejected|failed|error|blocked/i.test(row.action_label) || /denied|rejected|failed|error|blocked/i.test(row.description)).length;
  const modifiedSettings = filteredLogs.filter((row) => /setting|config/i.test(row.content_type) || /setting|config/i.test(row.action_label)).length;
  const actionOptions = Array.from(new Set(logs.map((row) => row.action_label))).sort();

  if (!canViewAudit) {
    return <StatePanel variant="info" title="Activity logs restricted" message="Only administrators and directors can view the audit trail." />;
  }

  return (
    <div className="space-y-8">
      <section className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Activity Logs</p>
            <h2 className="headline-font mt-3 text-4xl font-extrabold tracking-[-0.06em] text-[var(--ink)]">
              Institutional audit trail
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              Review user actions, administrative changes, and record-level audit events across the system.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => downloadCsv(filteredLogs)}
              className="secondary-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button type="button" className="primary-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold">
              <Filter className="h-4 w-4" />
              Advanced Filters
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="dark-hero-card rounded-xl px-6 py-5 text-white">
            <p className="section-kicker text-white/55">Critical Failures</p>
            <p className="headline-font mt-3 text-4xl font-extrabold tracking-[-0.06em]">{flaggedEvents}</p>
            <p className="mt-2 text-sm text-white/65">Flagged events in current view</p>
          </div>
          <div className="surface-panel rounded-xl px-6 py-5">
            <p className="section-kicker">Active Users</p>
            <p className="headline-font mt-3 text-4xl font-extrabold tracking-[-0.06em]">{uniqueUsers}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Distinct users in filtered logs</p>
          </div>
          <div className="surface-panel rounded-xl px-6 py-5">
            <p className="section-kicker">Configuration Actions</p>
            <p className="headline-font mt-3 text-4xl font-extrabold tracking-[-0.06em]">{modifiedSettings}</p>
            <p className="mt-2 text-sm text-[var(--danger)]">Settings or configuration updates</p>
          </div>
        </div>
      </section>

      <section className="surface-panel overflow-hidden rounded-xl">
        <div className="grid gap-3 bg-[var(--surface-low)] px-6 py-4 md:grid-cols-[1.2fr_0.9fr_0.9fr_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search activity logs, record IDs, or users"
            className="institutional-input rounded-md px-4 py-2.5 outline-none"
          />
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="institutional-input rounded-md px-4 py-2.5 outline-none"
          >
            <option value="all">All actions</option>
            {actionOptions.map((option) => (
              <option key={option} value={option}>
                {sentenceCase(option)}
              </option>
            ))}
          </select>
          <div className="table-stat rounded-md px-4 py-2.5 text-sm font-medium text-[var(--muted)]">
            Showing {filteredLogs.length} records
          </div>
        </div>

        {error ? <InlineBanner variant="error" title="Activity logs unavailable" message={error} className="mx-6 mt-5" /> : null}

        <DataTable
          columns={[
            {
              key: "created_at",
              label: "Timestamp",
              render: (row) => (
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">{formatDateTime(row.created_at)}</p>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">{row.object_id || "No object ID"}</p>
                </div>
              )
            },
            {
              key: "user",
              label: "User",
              render: (row) => (
                <div>
                  <p className="font-semibold text-[var(--ink)]">{row.user}</p>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">{row.content_type}</p>
                </div>
              )
            },
            {
              key: "action",
              label: "Action",
              render: (row) => (
                <div>
                  <p className="text-sm font-medium text-[var(--ink)]">{row.message ?? `${sentenceCase(row.action_label)} on ${row.content_type}`}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{row.description || "No description"}</p>
                </div>
              )
            },
            { key: "content_type", label: "Record" },
            { key: "created_at_label", label: "Recorded", render: (row) => formatDateTime(row.created_at) }
          ]}
          rows={filteredLogs}
          isLoading={isLoading}
          loadingMessage="Loading audit events..."
          emptyMessage="No activity logs available."
        />
      </section>
    </div>
  );
}
