import { Download, Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "../components/DataTable";
import { InlineBanner, StatePanel } from "../components/FeedbackStates";
import { useSession } from "../context/SessionContext";
import { useToast } from "../context/ToastContext";
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
  const toast = useToast();
  const [logs, setLogs] = useState<ActivityLogRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [recordFilter, setRecordFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
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
      const matchesUser = userFilter === "all" || row.user === userFilter;
      const matchesRecord = recordFilter === "all" || row.content_type === recordFilter;
      const entryDate = row.created_at.slice(0, 10);
      const matchesFromDate = !fromDate || entryDate >= fromDate;
      const matchesToDate = !toDate || entryDate <= toDate;
      return matchesQuery && matchesAction && matchesUser && matchesRecord && matchesFromDate && matchesToDate;
    });
  }, [actionFilter, fromDate, logs, query, recordFilter, toDate, userFilter]);

  const uniqueUsers = new Set(filteredLogs.map((row) => row.user)).size;
  const flaggedEvents = filteredLogs.filter((row) => /denied|rejected|failed|error|blocked/i.test(row.action_label) || /denied|rejected|failed|error|blocked/i.test(row.description)).length;
  const modifiedSettings = filteredLogs.filter((row) => /setting|config/i.test(row.content_type) || /setting|config/i.test(row.action_label)).length;
  const actionOptions = Array.from(new Set(logs.map((row) => row.action_label))).sort();
  const userOptions = Array.from(new Set(logs.map((row) => row.user).filter(Boolean))).sort();
  const recordOptions = Array.from(new Set(logs.map((row) => row.content_type).filter(Boolean))).sort();

  if (!canViewAudit) {
    return <StatePanel variant="info" title="Activity logs restricted" message="Only authorized roles can view activity logs." />;
  }

  const handleExport = () => {
    if (!filteredLogs.length) {
      toast.warning("No activity logs to export.");
      return;
    }
    try {
      downloadCsv(filteredLogs);
      toast.success(`${filteredLogs.length} activity log(s) exported.`, "CSV exported");
    } catch (reason: unknown) {
      toast.error(reason instanceof Error ? reason.message : "Export failed");
    }
  };

  return (
    <div className="space-y-4">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="headline-font text-xl font-extrabold tracking-[-0.04em] text-[var(--ink)]">
            Activity Logs
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="secondary-button inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((current) => !current)}
              className="primary-button inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold"
            >
              <Filter className="h-3.5 w-3.5" />
              {showAdvancedFilters ? "Hide Filters" : "Advanced Filters"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="dark-hero-card rounded-xl px-4 py-3 text-white">
            <p className="section-kicker text-white/55">Critical Failures</p>
            <p className="headline-font mt-2 text-2xl font-extrabold tracking-[-0.06em]">{flaggedEvents}</p>
            <p className="mt-1 text-xs text-white/65">Flagged events</p>
          </div>
          <div className="surface-panel rounded-xl px-4 py-3">
            <p className="section-kicker">Active Users</p>
            <p className="headline-font mt-2 text-2xl font-extrabold tracking-[-0.06em]">{uniqueUsers}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Users in view</p>
          </div>
          <div className="surface-panel rounded-xl px-4 py-3">
            <p className="section-kicker">Configuration Actions</p>
            <p className="headline-font mt-2 text-2xl font-extrabold tracking-[-0.06em]">{modifiedSettings}</p>
            <p className="mt-1 text-xs text-[var(--danger)]">Settings changes</p>
          </div>
        </div>
      </section>

      <section className="surface-panel overflow-hidden rounded-xl">
        <div className="grid gap-2 bg-[var(--surface-low)] px-4 py-3 md:grid-cols-[1.2fr_0.9fr_0.9fr_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search activity logs, record IDs, or users"
            className="institutional-input rounded-md px-3 py-2 text-sm outline-none"
          />
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="institutional-input rounded-md px-3 py-2 text-sm outline-none"
          >
            <option value="all">All actions</option>
            {actionOptions.map((option) => (
              <option key={option} value={option}>
                {sentenceCase(option)}
              </option>
            ))}
          </select>
          <div className="table-stat rounded-md px-3 py-2 text-xs font-medium text-[var(--muted)]">
            Showing {filteredLogs.length} records
          </div>
        </div>

        {showAdvancedFilters ? (
          <div className="grid gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-4 py-3 md:grid-cols-4">
            <select
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
              className="institutional-input rounded-md px-3 py-2 outline-none"
            >
              <option value="all">All users</option>
              {userOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={recordFilter}
              onChange={(event) => setRecordFilter(event.target.value)}
              className="institutional-input rounded-md px-3 py-2 outline-none"
            >
              <option value="all">All record types</option>
              {recordOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="institutional-input rounded-md px-3 py-2 outline-none" />
            <div className="flex gap-3">
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="institutional-input min-w-0 flex-1 rounded-md px-3 py-2 outline-none" />
              <button
                type="button"
                onClick={() => {
                  setUserFilter("all");
                  setRecordFilter("all");
                  setFromDate("");
                  setToDate("");
                }}
                className="secondary-button rounded-md px-3 py-2 text-sm font-semibold"
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}

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
