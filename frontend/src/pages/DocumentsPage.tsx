import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { SectionCard } from "../components/SectionCard";
import { fetchDocuments } from "../lib/api";
import { formatDateTime, sentenceCase } from "../lib/format";
import type { DocumentRecord } from "../types";

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments()
      .then((data) => setDocuments(data.documents))
      .catch((reason) => setError(reason.message));
  }, []);

  return (
    <SectionCard title="Documents" subtitle="Request and invitation files.">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
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
              <a href={row.url} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-cyan-500 dark:text-slate-900">
                Open
              </a>
            )
          }
        ]}
        rows={documents}
        emptyMessage="No documents available."
      />
    </SectionCard>
  );
}
