import { Download, FileText, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useToast } from "../context/ToastContext";

type AttachmentPreviewPanelProps = {
  isOpen: boolean;
  title: string;
  fileName?: string;
  fileUrl: string;
  onClose: () => void;
};

function detectFileType(url: string, fileName?: string) {
  const source = `${fileName ?? ""} ${url}`.toLowerCase();
  if (source.match(/\.(jpg|jpeg|png|gif|webp|bmp)($|\?)/)) return "image";
  if (source.match(/\.pdf($|\?)/)) return "pdf";
  return "other";
}

export function AttachmentPreviewPanel({ isOpen, title, fileName, fileUrl, onClose }: AttachmentPreviewPanelProps) {
  const toast = useToast();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const fileType = detectFileType(fileUrl, fileName);

  return (
    <div
      className="panel-backdrop fixed inset-0 z-50 flex justify-end bg-[var(--surface)]/40 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      <div
        ref={panelRef}
        className="panel-drawer flex h-full w-full max-w-xl flex-col border-l border-[var(--line)] bg-[var(--surface-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-[var(--ink)]">{title}</p>
            {fileName ? (
              <p className="mt-0.5 truncate text-sm text-[var(--muted)]">{fileName}</p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--muted)] transition hover:bg-[var(--surface-low)] hover:text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview area */}
        <div className="min-h-0 flex-1 overflow-auto rounded-none bg-[var(--surface-low)] p-4">
          {fileType === "image" ? (
            <img
              src={fileUrl}
              alt={fileName || title}
              onError={() => toast.error("File preview failed.")}
              className="h-auto w-full rounded-lg object-contain"
            />
          ) : null}
          {fileType === "pdf" ? (
            <iframe
              src={fileUrl}
              title={fileName || title}
              onError={() => toast.error("PDF preview failed.")}
              className="h-full min-h-[72vh] w-full rounded-lg border border-[var(--line)]"
            />
          ) : null}
          {fileType === "other" ? (
            <div className="grid h-full min-h-48 place-items-center text-center">
              <div>
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[var(--surface-container)] text-[var(--muted)]">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="text-sm text-[var(--muted)]">Preview is not available for this file type.</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[var(--line)] px-5 py-4">
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="primary-button inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
          >
            <Download className="h-4 w-4" />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}
