import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "../components/DataTable";
import { InlineBanner } from "../components/FeedbackStates";
import { fetchDocuments, resolveAssetUrl } from "../lib/api";
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
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1fr_18rem]">
        <div className="metric-strip rounded-xl px-4 py-4">
          <h2 className="headline-font text-xl font-extrabold tracking-[-0.04em] text-[var(--ink)]">
            Documents
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="table-stat rounded-xl px-4 py-3">
              <p className="section-kicker">Total files</p>
              <p className="mt-1.5 text-xl font-bold text-[var(--ink)]">{documents.length}</p>
            </div>
            <div className="table-stat rounded-xl px-4 py-3">
              <p className="section-kicker">Request files</p>
              <p className="mt-1.5 text-xl font-bold text-[var(--ink)]">{requestCount}</p>
            </div>
            <div className="table-stat rounded-xl px-4 py-3">
              <p className="section-kicker">Invitation files</p>
              <p className="mt-1.5 text-xl font-bold text-[var(--ink)]">{invitationCount}</p>
            </div>
          </div>
        </div>

        <div className="hero-card rounded-xl p-4">
          <p className="section-kicker">Summary</p>
          <h3 className="headline-font mt-2 text-base font-bold tracking-[-0.03em] text-[var(--ink)]">
            Record files
          </h3>
          <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
            Review upload dates and open linked files.
          </p>
        </div>
      </section>

      <section className="surface-panel overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-low)] px-4 py-3">
          <div className="relative min-w-[14rem] flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by file name, record, or type"
              className="institutional-input w-full rounded-md px-3 py-2 pl-9 text-sm outline-none"
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
                  href={resolveAssetUrl(row.url)}
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
          loadingMessage="Loading documents..."
          emptyMessage="No documents available."
        />
      </section>
    </div>
  );
}
