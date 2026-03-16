import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FilterBar } from "../components/FilterBar";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { createInvitation, fetchInvitations } from "../lib/api";
import { formatDateTime } from "../lib/format";
import type { InvitationRecord } from "../types";

export function InvitationsPage() {
  const [rows, setRows] = useState<InvitationRecord[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("event_date");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState({
    inviting_organization: "",
    event_title: "",
    description: "",
    location: "",
    event_date: "",
    contact_person: "",
    contact_email: "",
    contact_phone: ""
  });
  const invitationFields: Array<{ key: keyof typeof draft; label: string; type: string }> = [
    { key: "inviting_organization", label: "Organization", type: "text" },
    { key: "event_title", label: "Event title", type: "text" },
    { key: "description", label: "Description", type: "text" },
    { key: "location", label: "Location", type: "text" },
    { key: "event_date", label: "Event date and time", type: "datetime-local" },
    { key: "contact_person", label: "Contact name", type: "text" },
    { key: "contact_email", label: "Contact email", type: "email" },
    { key: "contact_phone", label: "Contact phone", type: "text" },
  ];

  const loadInvitations = async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("ordering", ordering);
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const response = await fetchInvitations(params);
      setRows(response.results);
      setCount(response.count);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load invitations");
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

  return (
    <div className="space-y-6">
      <SectionCard title="Create Invitation" subtitle="Register a new invitation.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {invitationFields.map((field) => (
            <input
              key={field.key}
              value={draft[field.key]}
              onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
              placeholder={field.label}
              type={field.type}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-900"
            />
          ))}
        </div>
        <button
          onClick={() =>
            void createInvitation({
              ...draft,
              event_date: draft.event_date ? new Date(draft.event_date).toISOString() : ""
            })
              .then(() => {
                setDraft({
                  inviting_organization: "",
                  event_title: "",
                  description: "",
                  location: "",
                  event_date: "",
                  contact_person: "",
                  contact_email: "",
                  contact_phone: ""
                });
                return loadInvitations();
              })
              .catch((reason) => setError(reason.message))
          }
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-cyan-500 dark:text-slate-900"
        >
          Create Invitation
        </button>
      </SectionCard>

      <SectionCard title="Invitations" subtitle="Invitation list and status.">
        <FilterBar>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search organization or event title"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-900"
          />
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-900"
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
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Showing {rows.length} invitation{rows.length === 1 ? "" : "s"}
          </div>
        </FilterBar>
        {error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : (
          <DataTable
            columns={[
              { key: "id", label: "Invitation ID", render: (row) => <span className="font-semibold">{row.id.slice(0, 8)}</span> },
              { key: "inviting_organization", label: "Inviting Organization", sortable: true, sortKey: "inviting_organization" },
              { key: "event_title", label: "Event Title", sortable: true, sortKey: "event_title" },
              { key: "event_date", label: "Event Date", sortable: true, sortKey: "event_date", render: (row) => formatDateTime(row.event_date) },
              { key: "location", label: "Event Location" },
              { key: "status_display", label: "Status", sortable: true, sortKey: "status", render: (row) => <StatusBadge status={row.status_display} /> },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <Link to={`/invitations/${row.id}`} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-cyan-500 dark:text-slate-900">
                    View
                  </Link>
                )
              }
            ]}
            rows={rows}
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
        )}
      </SectionCard>
    </div>
  );
}
