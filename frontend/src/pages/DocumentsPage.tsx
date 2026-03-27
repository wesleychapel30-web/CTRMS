import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "../components/DataTable";
import { InlineBanner } from "../components/FeedbackStates";
import { fetchDocuments } from "../lib/api";
import { formatDateTime, sentenceCase } from "../lib/format";
import type { DocumentRecord } from "../types";

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Unable to load documents";
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [recordType, setRecordType] = useState<"all" | "request" | "invitation">("all");

  useEffect(() => {
    setIsLoading(true);
    fetchDocuments()
      .then((data) => {
        setDocuments(data.documents);
        setError(null);
      })
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredDocuments = useMemo(() => {
    return documents.filter((item) => {
      const matchesType = recordType === "all" || item.record_type === recordType;
      const haystack = `${item.name} ${item.linked_record} ${item.type}`.toLowerCase();
      const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
      return matchesType && matchesQuery;
    });
  }, [documents, query, recordType]);

  const requestCount = documents.filter((item) => item.record_type === "request").length;
  const invitationCount = documents.filter((item) => item.record_type === "invitation").length;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="metric-strip rounded-xl px-6 py-7">
          <p className="section-kicker">Document Library</p>
          <h2 className="headline-font mt-3 text-4xl font-extrabold tracking-[-0.06em] text-[var(--ink)]">
            Institutional records and attachments
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            Browse uploaded files linked to requests and invitations, review upload dates, and open record attachments from a single operational library.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="table-stat rounded-xl px-5 py-4">
              <p className="section-kicker">Total files</p>
              <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{documents.length}</p>
            </div>
            <div className="table-stat rounded-xl px-5 py-4">
              <p className="section-kicker">Request files</p>
              <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{requestCount}</p>
            </div>
            <div className="table-stat rounded-xl px-5 py-4">
              <p className="section-kicker">Invitation files</p>
              <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{invitationCount}</p>
            </div>
          </div>
        </div>

        <div className="hero-card rounded-xl p-6">
          <p className="section-kicker">Archive Summary</p>
          <h3 className="headline-font mt-3 text-xl font-bold tracking-[-0.04em] text-[var(--ink)]">
            Active record storage
          </h3>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            Use the document library to verify record attachments, trace upload dates, and open linked files without leaving the system workflow.
          </p>
        </div>
      </section>

      <section className="surface-panel overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--surface-low)] px-6 py-4">
          <div className="relative min-w-[16rem] flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by file name, record, or type"
              className="institutional-input w-full rounded-md px-4 py-2.5 pl-10 outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRecordType("all")}
              className={`rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] ${
                recordType === "all" ? "bg-[var(--surface-card)] text-[var(--accent)] shadow-sm" : "text-[var(--muted)]"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setRecordType("request")}
              className={`rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] ${
                recordType === "request" ? "bg-[var(--surface-card)] text-[var(--accent)] shadow-sm" : "text-[var(--muted)]"
              }`}
            >
              Requests
            </button>
            <button
              type="button"
              onClick={() => setRecordType("invitation")}
              className={`rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] ${
                recordType === "invitation" ? "bg-[var(--surface-card)] text-[var(--accent)] shadow-sm" : "text-[var(--muted)]"
              }`}
            >
              Invitations
            </button>
          </div>
        </div>

        {error ? <InlineBanner variant="error" title="Documents unavailable" message={error} className="mx-6 mt-5" /> : null}

        <DataTable
          columns={[
            { key: "name", label: "File Name" },
            { key: "type", label: "Type", render: (row) => `${sentenceCase(row.record_type)} · ${row.type}` },
            { key: "linked_record", label: "Linked Record" },
            { key: "uploaded_at", label: "Uploaded", render: (row) => formatDateTime(row.uploaded_at) },
            {
              key: "actions",
              label: "Action",
              render: (row) => (
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                  className="secondary-button inline-flex rounded-md px-3 py-1.5 text-xs font-semibold"
                >
                  Open
                </a>
              )
            }
          ]}
          rows={filteredDocuments}
          isLoading={isLoading}
          loadingMessage="Loading document library..."
          emptyMessage="No documents available."
        />
      </section>
    </div>
  );
}
