import { CalendarDays, Download, Plus, Printer, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { InlineBanner } from "../components/FeedbackStates";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import { createInvitation, fetchInvitations } from "../lib/api";
import { formatDateTime } from "../lib/format";
import type { InvitationRecord } from "../types";

const emptyDraft = {
  inviting_organization: "",
  event_title: "",
  description: "",
  location: "",
  event_date: "",
  contact_person: "",
  contact_email: "",
  contact_phone: ""
};

type Draft = typeof emptyDraft;

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Unable to load invitations";
}

function downloadInvitationsCsv(rows: InvitationRecord[]) {
  const header = ["Invitation ID", "Organization", "Event Title", "Event Date", "Location", "Status"];
  const data = rows.map((row) => [
    row.id,
    row.inviting_organization,
    row.event_title,
    row.event_date,
    row.location,
    row.status_display
  ]);
  const csv = [header, ...data]
    .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "invitations.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function InvitationsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<InvitationRecord[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("event_date");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [showComposer, setShowComposer] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const invitationFields: Array<{ key: keyof Draft; label: string; type: string }> = [
    { key: "inviting_organization", label: "Organization", type: "text" },
    { key: "event_title", label: "Event title", type: "text" },
    { key: "description", label: "Description", type: "text" },
    { key: "location", label: "Location", type: "text" },
    { key: "event_date", label: "Event date and time", type: "datetime-local" },
    { key: "contact_person", label: "Contact name", type: "text" },
    { key: "contact_email", label: "Contact email", type: "email" },
    { key: "contact_phone", label: "Contact phone", type: "text" }
  ];

  const loadInvitations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("ordering", ordering);
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const response = await fetchInvitations(params);
      setRows(response.results);
      setCount(response.count);
      setError(null);
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadInvitations();
  }, [page, ordering, search, status]);

  const sort = ordering
    ? {
        key: ordering.startsWith("-") ? ordering.slice(1) : ordering,
        direction: ordering.startsWith("-") ? ("desc" as const) : ("asc" as const)
      }
    : null;

  const pendingCount = rows.filter((item) => item.status === "pending_review").length;
  const confirmedCount = rows.filter((item) => item.status === "confirmed_attendance").length;
  const attendanceRate = rows.length ? Math.round((confirmedCount / rows.length) * 100) : 0;
  const nextMajorEvent = rows
    .slice()
    .sort((left, right) => new Date(left.event_date).getTime() - new Date(right.event_date).getTime())
    .find((item) => new Date(item.event_date).getTime() >= Date.now());
  const insightRecord = nextMajorEvent ?? rows[0] ?? null;

  const upcomingInvitations = useMemo(
    () =>
      rows
        .filter((item) => new Date(item.event_date).getTime() >= Date.now())
        .slice()
        .sort((left, right) => new Date(left.event_date).getTime() - new Date(right.event_date).getTime())
        .slice(0, 3),
    [rows]
  );

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await createInvitation({
        ...draft,
        event_date: draft.event_date ? new Date(draft.event_date).toISOString() : ""
      });
      setDraft(emptyDraft);
      setShowComposer(false);
      await loadInvitations();
      toast.success("Invitation registered successfully.", "Invitation issued");
    } catch (reason: unknown) {
      const message = getErrorMessage(reason);
      setError(message);
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="metric-strip rounded-xl px-6 py-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="section-kicker">Invitation Registry</p>
              <h2 className="headline-font mt-3 text-4xl font-extrabold tracking-[-0.06em] text-[var(--ink)]">
                Institutional Invitations
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                Manage official event participation, review invitation decisions, and track executive attendance across upcoming institutional engagements.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShowComposer((current) => !current)}
                className="secondary-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
              >
                <Plus className="h-4 w-4" />
                {showComposer ? "Close Form" : "Issue Invitation"}
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-[repeat(3,minmax(0,1fr))_15rem]">
            <div className="metric-segment">
              <p className="section-kicker">Pending</p>
              <p className="headline-font mt-2 text-4xl font-extrabold tracking-[-0.06em]">{pendingCount}</p>
              <p className="mt-1 text-xs font-medium text-[var(--muted)]">Current page review queue</p>
            </div>
            <div className="metric-segment">
              <p className="section-kicker">Confirmed</p>
              <p className="headline-font mt-2 text-4xl font-extrabold tracking-[-0.06em]">{confirmedCount}</p>
              <p className="mt-1 text-xs font-medium text-[var(--muted)]">Attendance confirmations</p>
            </div>
            <div className="metric-segment">
              <p className="section-kicker">Attendance</p>
              <p className="headline-font mt-2 text-4xl font-extrabold tracking-[-0.06em] text-[var(--accent)]">{attendanceRate}%</p>
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--muted)]">
                <TrendingUp className="h-3.5 w-3.5" />
                Confirmed on current view
              </p>
            </div>
            <div className="hero-card rounded-xl p-5">
              <p className="section-kicker">Next Major Event</p>
              {nextMajorEvent ? (
                <>
                  <p className="headline-font mt-4 text-xl font-bold tracking-[-0.04em] text-[var(--ink)]">{nextMajorEvent.event_title}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {new Date(nextMajorEvent.event_date).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric"
                    })}
                    {" · "}
                    {nextMajorEvent.location}
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm text-[var(--muted)]">No scheduled events on the current invitation view.</p>
              )}
            </div>
          </div>
        </div>

        {showComposer ? (
          <div className="surface-panel rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker">Issue Invitation</p>
                <h3 className="headline-font mt-2 text-2xl font-bold tracking-[-0.04em] text-[var(--ink)]">
                  Register a New Invitation
                </h3>
                <p className="mt-2 text-sm text-[var(--muted)]">Capture event, organizer, and contact details before routing the record for review.</p>
              </div>
              <span className="rounded-sm bg-[var(--surface-low)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Form
              </span>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {invitationFields.map((field) => (
                <label key={field.key} className={`grid gap-2 ${field.key === "description" ? "md:col-span-2" : ""}`}>
                  <span className="section-kicker">{field.label}</span>
                  <input
                    value={draft[field.key]}
                    onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                    placeholder={field.label}
                    type={field.type}
                    className="institutional-input rounded-md px-4 py-3 outline-none"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDraft(emptyDraft);
                  setShowComposer(false);
                }}
                className="secondary-button rounded-md px-4 py-2.5 text-sm font-semibold"
              >
                Discard
              </button>
              <button
                type="button"
                disabled={isCreating}
                onClick={() => void handleCreate()}
                className="primary-button rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {isCreating ? "Registering..." : "Issue Invitation"}
              </button>
            </div>
          </div>
        ) : (
          <div className="hero-card rounded-xl p-6">
            <p className="section-kicker">Invitation Pulse</p>
            <h3 className="headline-font mt-3 text-2xl font-bold tracking-[-0.04em] text-[var(--ink)]">
              Review-ready executive invitations
            </h3>
            <p className="mt-3 max-w-lg text-sm leading-7 text-[var(--muted)]">
              The registry is aligned for director review, acceptance, decline, and attendance confirmation with full record history preserved on each invitation.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="table-stat rounded-lg px-4 py-3">
                <p className="section-kicker">Registry total</p>
                <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{count} invitations</p>
              </div>
              <div className="table-stat rounded-lg px-4 py-3">
                <p className="section-kicker">Current status filter</p>
                <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{status || "All statuses"}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="surface-panel rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--surface-low)] px-6 py-4">
          <div>
            <h3 className="headline-font text-base font-bold tracking-[-0.03em] text-[var(--ink)]">Current Invitation Registry</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">Review invitation status, organizer details, and upcoming engagement dates.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative min-w-[16rem]">
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search invitations, organizers, or IDs"
                className="institutional-input w-full rounded-md px-4 py-2.5 pr-10 text-sm outline-none"
              />
            </label>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="institutional-input rounded-md px-4 py-2.5 text-sm outline-none"
            >
              <option value="">All statuses</option>
              <option value="pending_review">Pending Review</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
              <option value="confirmed_attendance">Confirmed Attendance</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="archived">Archived</option>
            </select>
            <button type="button" onClick={() => downloadInvitationsCsv(rows)} className="secondary-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold">
              <Download className="h-4 w-4" />
              Export
            </button>
            <button type="button" onClick={() => window.print()} className="secondary-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold">
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>

        {error ? <InlineBanner variant="error" title="Invitations unavailable" message={error} className="mx-6 mt-5" actionLabel="Retry" onAction={() => void loadInvitations()} /> : null}

        <DataTable
          columns={[
            {
              key: "id",
              label: "Invitation ID",
              render: (row) => <span className="font-mono text-xs font-semibold text-[var(--accent)]">{row.id.slice(0, 8)}</span>
            },
            {
              key: "event_title",
              label: "Event Name",
              sortable: true,
              sortKey: "event_title",
              render: (row) => (
                <div>
                  <p className="font-semibold text-[var(--ink)]">{row.event_title}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{row.description || "Institutional event record"}</p>
                </div>
              )
            },
            { key: "inviting_organization", label: "Organizer", sortable: true, sortKey: "inviting_organization" },
            {
              key: "event_date",
              label: "Event Date",
              sortable: true,
              sortKey: "event_date",
              render: (row) => formatDateTime(row.event_date)
            },
            {
              key: "status_display",
              label: "Status",
              sortable: true,
              sortKey: "status",
              render: (row) => <StatusBadge status={row.status_display} />
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex justify-end">
                  <Link
                    to={`/invitations/${row.id}`}
                    className="secondary-button inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold"
                  >
                    View Details
                  </Link>
                </div>
              )
            }
          ]}
          rows={rows}
          isLoading={isLoading}
          loadingMessage="Loading invitation registry..."
          sort={sort}
          onSortChange={(next) => {
            if (!next) {
              setOrdering("event_date");
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
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div>
            <p className="section-kicker">Upcoming Invitations</p>
            <h3 className="headline-font mt-2 text-xl font-bold tracking-[-0.04em] text-[var(--ink)]">Near-term engagements</h3>
          </div>
          {upcomingInvitations.length ? (
            upcomingInvitations.map((item) => (
                <button key={item.id} type="button" onClick={() => navigate(`/invitations/${item.id}`)} className="surface-panel flex w-full items-start gap-4 rounded-xl p-4 text-left">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-[var(--surface-low)]">
                  <CalendarDays className="h-5 w-5 text-[var(--accent)]" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--ink)]">{item.event_title}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{formatDateTime(item.event_date)}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{item.location}</p>
                </div>
              </button>
            ))
          ) : (
            <div className="surface-panel rounded-xl p-5 text-sm text-[var(--muted)]">No upcoming invitations are scheduled on this view.</div>
          )}
        </div>

        <div className="hero-card rounded-xl p-8">
          <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="section-kicker">Invitation Insights</p>
              <h3 className="headline-font mt-3 text-2xl font-bold tracking-[-0.04em] text-[var(--ink)]">
                Institutional response summary
              </h3>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                {insightRecord
                  ? `The next highlighted event is ${insightRecord.event_title}. Use the registry to confirm attendance, review institutional context, and keep decision history attached to the record.`
                  : "As invitations arrive, this panel will summarize response progress and highlight the next event requiring attention."}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="table-stat rounded-lg px-4 py-4">
                  <p className="section-kicker">Response rate</p>
                  <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{attendanceRate}%</p>
                </div>
                <div className="table-stat rounded-lg px-4 py-4">
                  <p className="section-kicker">Current page total</p>
                  <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{rows.length}</p>
                </div>
              </div>
            </div>
            <div className="grid place-items-center">
              <div
                className="relative grid h-48 w-48 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(var(--accent) 0deg, var(--accent) ${attendanceRate * 3.6}deg, var(--surface-container) ${attendanceRate * 3.6}deg 360deg)`
                }}
              >
                <div className="grid h-32 w-32 place-items-center rounded-full bg-[var(--surface-card)] text-center shadow-sm">
                  <p className="headline-font text-3xl font-extrabold tracking-[-0.05em] text-[var(--ink)]">{attendanceRate}%</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Response Rate</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
