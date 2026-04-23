import { CalendarDays, Download, Plus, Printer, Search, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { InlineBanner } from "../components/FeedbackStates";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import { createInvitation, fetchInvitations } from "../lib/api";
import { formatDateTime } from "../lib/format";
import type { ApiListResponse, InvitationRecord } from "../types";

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

const invitationStatusOptions = [
  { value: "", label: "All statuses" },
  { value: "pending_review", label: "Pending Review" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "confirmed_attendance", label: "Confirmed Attendance" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "archived", label: "Archived" }
] as const;

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Unable to load invitations";
}

function formatEventDateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function normalizeInvitationListResponse(payload: ApiListResponse<InvitationRecord> | InvitationRecord[]) {
  if (Array.isArray(payload)) {
    return {
      results: payload,
      count: payload.length
    };
  }

  return {
    results: Array.isArray(payload.results) ? payload.results : [],
    count: typeof payload.count === "number" ? payload.count : 0
  };
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
      const response = normalizeInvitationListResponse(
        (await fetchInvitations(params)) as ApiListResponse<InvitationRecord> | InvitationRecord[]
      );
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

  useEffect(() => {
    if (!showComposer) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isCreating) {
        setShowComposer(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showComposer, isCreating]);

  const sort = ordering
    ? {
        key: ordering.startsWith("-") ? ordering.slice(1) : ordering,
        direction: ordering.startsWith("-") ? ("desc" as const) : ("asc" as const)
      }
    : null;

  const pendingCount = rows.filter((item) => item.status === "pending_review").length;
  const confirmedCount = rows.filter((item) => item.status === "confirmed_attendance").length;
  const attendanceRate = rows.length ? Math.round((confirmedCount / rows.length) * 100) : 0;
  const currentStatusLabel = invitationStatusOptions.find((option) => option.value === status)?.label ?? "All statuses";
  const scheduledCount = rows.filter((item) => new Date(item.event_date).getTime() >= Date.now()).length;
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
    <>
      <div className="space-y-4">
        <section className="grid gap-3 xl:grid-cols-12">
          <div className="surface-panel self-start rounded-xl px-4 py-3 xl:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="headline-font text-xl font-extrabold tracking-[-0.04em] text-[var(--ink)] sm:text-2xl">
                Invitations
              </h2>
              <button
                type="button"
                onClick={() => setShowComposer(true)}
                className="primary-button inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                New Invitation
              </button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <InvitationMetricCard label="Pending" value={pendingCount} note="Awaiting response" />
              <InvitationMetricCard label="Confirmed" value={confirmedCount} note="Attendance confirmed" />
              <InvitationMetricCard
                label="Attendance %"
                value={`${attendanceRate}%`}
                note="Confirmed on current view"
                accent
                icon={<TrendingUp className="h-3.5 w-3.5" />}
              />
              <InvitationMajorEventCard event={nextMajorEvent} />
            </div>
          </div>

          <aside className="hero-card self-start rounded-xl p-4 xl:col-span-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="headline-font text-lg font-bold tracking-[-0.04em] text-[var(--ink)]">
                  Invitation Overview
                </h3>
              </div>
              <div className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink)]">
                {currentStatusLabel}
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-4 xl:grid-cols-2">
              <OverviewStat label="Registry total" value={`${count}`} helper="Total records" />
              <OverviewStat label="Current view" value={`${rows.length}`} helper="Rows on page" />
              <OverviewStat label="Status filter" value={currentStatusLabel} helper="Applied filter" />
              <OverviewStat label="Scheduled" value={`${scheduledCount}`} helper="Upcoming items" />
            </div>

            <div className="mt-3 rounded-lg bg-white/8 px-3 py-2.5 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/10">
                  <CalendarDays className="h-4 w-4 text-[var(--ink)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Next Major Event</p>
                  {nextMajorEvent ? (
                    <>
                      <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">{nextMajorEvent.event_title}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                        {formatEventDateLabel(nextMajorEvent.event_date)} {" · "} {nextMajorEvent.location}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-[var(--muted)]">No scheduled event on this view.</p>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="surface-panel overflow-hidden rounded-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-low)] px-4 py-3">
            <h3 className="headline-font text-sm font-bold tracking-[-0.02em] text-[var(--ink)]">Invitation List</h3>
            <div className="flex flex-1 flex-wrap justify-end gap-2">
              <label className="relative min-w-[14rem] max-w-md flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search invitations"
                  className="institutional-input w-full rounded-md px-3 py-2 pl-9 text-sm outline-none"
                />
              </label>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                className="institutional-input rounded-md px-3 py-2 text-sm outline-none"
              >
                {invitationStatusOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  downloadInvitationsCsv(rows);
                  toast.success(`${rows.length} invitation(s) exported.`, "CSV exported");
                }}
                className="secondary-button inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="secondary-button inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold"
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </button>
            </div>
          </div>

          {error ? (
            <InlineBanner
              variant="error"
              title="Invitations unavailable"
              message={error}
              className="mx-6 mt-5"
              actionLabel="Retry"
              onAction={() => void loadInvitations()}
            />
          ) : null}

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
                  <div className="max-w-[16rem]">
                    <p className="truncate font-semibold text-[var(--ink)]" title={row.event_title}>
                      {row.event_title}
                    </p>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]" title={row.description || undefined}>
                      {row.description || "Event record"}
                    </p>
                  </div>
                )
              },
              {
                key: "inviting_organization",
                label: "Organizer",
                sortable: true,
                sortKey: "inviting_organization",
                render: (row) => (
                  <span className="block max-w-[12rem] truncate" title={row.inviting_organization}>
                    {row.inviting_organization}
                  </span>
                )
              },
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
            density="compact"
            isLoading={isLoading}
            loadingMessage="Loading invitations..."
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

        <section className="grid gap-6 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <div className="surface-panel rounded-xl p-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="headline-font text-xl font-bold tracking-[-0.04em] text-[var(--ink)]">Upcoming Invitations</h3>
                <span className="rounded-full bg-[var(--surface-low)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  {upcomingInvitations.length}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {upcomingInvitations.length ? (
                  upcomingInvitations.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(`/invitations/${item.id}`)}
                      className="surface-panel flex w-full items-start gap-4 rounded-xl p-4 text-left"
                    >
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[var(--surface-low)]">
                        <CalendarDays className="h-5 w-5 text-[var(--accent)]" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--ink)]">{item.event_title}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{formatDateTime(item.event_date)}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{item.location}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-low)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                    No upcoming invitations are scheduled on this view.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="xl:col-span-7">
            <div className="hero-card rounded-xl p-6 sm:p-8">
              <div className="grid gap-6 md:grid-cols-[0.92fr_1.08fr] md:items-center">
                <div>
                  <h3 className="headline-font text-2xl font-bold tracking-[-0.04em] text-[var(--ink)]">
                    Invitation Insights
                  </h3>
                  {insightRecord ? (
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                      Next event: {insightRecord.event_title}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">No scheduled invitation is available on this view.</p>
                  )}
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
          </div>
        </section>
      </div>

      {showComposer ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
          onClick={() => {
            if (!isCreating) {
              setShowComposer(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="New invitation"
            className="surface-panel w-full max-w-4xl rounded-2xl p-6 shadow-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="headline-font text-2xl font-bold tracking-[-0.04em] text-[var(--ink)]">
                  New Invitation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isCreating) {
                    setShowComposer(false);
                  }
                }}
                className="secondary-button inline-flex h-10 w-10 items-center justify-center rounded-md"
                aria-label="Close invitation form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {invitationFields.map((field) => (
                <label key={field.key} className={`grid gap-2 ${field.key === "description" ? "md:col-span-2" : ""}`}>
                  <span className="section-kicker">{field.label}</span>
                  <input
                    value={draft[field.key]}
                    onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                    placeholder={field.label}
                    type={field.type}
                    disabled={isCreating}
                    className="institutional-input rounded-md px-4 py-3 outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={isCreating}
                onClick={() => {
                  setDraft(emptyDraft);
                  setShowComposer(false);
                }}
                className="secondary-button rounded-md px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                disabled={isCreating}
                onClick={() => void handleCreate()}
                className="primary-button rounded-md px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? (
                  <span className="flex items-center gap-2">
                    <span className="spin inline-block h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white" />
                    Registering...
                  </span>
                ) : (
                  "Create Invitation"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function InvitationMetricCard({
  label,
  value,
  note,
  accent = false,
  icon
}: {
  label: string;
  value: string | number;
  note: string;
  accent?: boolean;
  icon?: JSX.Element;
}) {
  return (
    <div className="metric-segment">
      <p className="section-kicker">{label}</p>
      <p className={`headline-font mt-1.5 text-2xl font-extrabold tracking-[-0.06em] ${accent ? "text-[var(--accent)]" : "text-[var(--ink)]"}`}>
        {value}
      </p>
      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--muted)]">
        {icon}
        <span>{note}</span>
      </p>
    </div>
  );
}

function InvitationMajorEventCard({ event }: { event: InvitationRecord | undefined }) {
  return (
    <div className="hero-card rounded-xl p-3.5">
      <p className="section-kicker">Next Major Event</p>
      {event ? (
        <>
          <p className="headline-font mt-2 line-clamp-1 text-sm font-bold tracking-[-0.03em] text-[var(--ink)]">
            {event.event_title}
          </p>
          <p className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">
            {formatEventDateLabel(event.event_date)} {" · "} {event.location}
          </p>
        </>
      ) : (
        <p className="mt-2 line-clamp-2 text-xs text-[var(--muted)]">No scheduled event on this view.</p>
      )}
    </div>
  );
}

function OverviewStat({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="table-stat rounded-lg px-3 py-3">
      <p className="section-kicker">{label}</p>
      <p className="mt-1 line-clamp-1 text-base font-semibold text-[var(--ink)]">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{helper}</p>
    </div>
  );
}
