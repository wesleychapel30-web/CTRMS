import { Download, FileText, Upload } from "lucide-react";
import { useState } from "react";
import { buildAttachmentPreviewUrl, resolveAssetUrl } from "../lib/api";
import { formatDateTime } from "../lib/format";
import type { EnterpriseAttachmentRecord } from "../types";
import { AttachmentPreviewPanel } from "./AttachmentPreviewPanel";

type EnterpriseAttachmentPanelProps = {
  attachments: EnterpriseAttachmentRecord[];
  canUpload?: boolean;
  isUploading?: boolean;
  uploadLabel?: string;
  emptyMessage?: string;
  onUpload?: (file: File, attachmentType: string) => Promise<void>;
};

export function EnterpriseAttachmentPanel({
  attachments,
  canUpload = false,
  isUploading = false,
  uploadLabel = "Upload Attachment",
  emptyMessage = "No attachments have been uploaded yet.",
  onUpload
}: EnterpriseAttachmentPanelProps) {
  const [attachmentType, setAttachmentType] = useState("Supporting Document");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<{ title: string; fileName?: string; fileUrl: string } | null>(null);

  const handleUpload = async () => {
    if (!attachment || !onUpload) {
      return;
    }
    await onUpload(attachment, attachmentType);
    setAttachment(null);
    setAttachmentType("Supporting Document");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {attachments.length ? (
          attachments.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-low)] px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--ink)]">{item.attachment_type}</p>
                <p className="mt-1 truncate text-xs text-[var(--muted)]">
                  {item.filename || "Uploaded file"} · {formatDateTime(item.uploaded_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewFile({
                      title: item.attachment_type,
                      fileName: item.filename,
                      fileUrl: buildAttachmentPreviewUrl(item.download_url, item.file)
                    })
                  }
                  className="secondary-button rounded-md px-3 py-1.5 text-xs font-semibold"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Preview
                </button>
                <a
                  href={resolveAssetUrl(item.download_url ?? item.file)}
                  target="_blank"
                  rel="noreferrer"
                  className="primary-button inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">{emptyMessage}</p>
        )}
      </div>

      {canUpload && onUpload ? (
        <div className="space-y-3 rounded-xl border border-[var(--surface-container)] p-4">
          <label className="grid gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Attachment Type</span>
            <input
              value={attachmentType}
              onChange={(event) => setAttachmentType(event.target.value)}
              className="institutional-input rounded-xl px-4 py-3 outline-none"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Document</span>
            <input
              type="file"
              onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
              className="institutional-input rounded-xl border-dashed px-4 py-4 outline-none"
            />
          </label>
          <button
            type="button"
            disabled={isUploading || !attachment}
            onClick={() => void handleUpload()}
            className="primary-button inline-flex items-center gap-2 rounded-md px-4 py-3 text-sm font-semibold disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {isUploading ? "Uploading..." : uploadLabel}
          </button>
        </div>
      ) : null}

      <AttachmentPreviewPanel
        isOpen={Boolean(previewFile)}
        title={previewFile?.title ?? "Attachment Preview"}
        fileName={previewFile?.fileName}
        fileUrl={previewFile?.fileUrl ?? ""}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
