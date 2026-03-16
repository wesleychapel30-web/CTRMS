import { Download, FileText, X } from "lucide-react";

type AttachmentPreviewPanelProps = {
  isOpen: boolean;
  title: string;
  fileName?: string;
  fileUrl: string;
  onClose: () => void;
};

function detectFileType(url: string, fileName?: string) {
  const source = `${fileName ?? ""} ${url}`.toLowerCase();
  if (source.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/)) return "image";
  if (source.match(/\.pdf($|\?)/)) return "pdf";
  return "other";
}

export function AttachmentPreviewPanel({ isOpen, title, fileName, fileUrl, onClose }: AttachmentPreviewPanelProps) {
  if (!isOpen) {
    return null;
  }

  const fileType = detectFileType(fileUrl, fileName);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm">
      <div className="h-full w-full max-w-xl border-l border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</p>
            {fileName ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{fileName}</p> : null}
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-[calc(100%-5.5rem)] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
          {fileType === "image" ? (
            <img src={fileUrl} alt={fileName || title} className="h-auto w-full rounded-lg object-contain" />
          ) : null}
          {fileType === "pdf" ? (
            <iframe src={fileUrl} title={fileName || title} className="h-[72vh] w-full rounded-lg border border-slate-200 dark:border-slate-700" />
          ) : null}
          {fileType === "other" ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-lg bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <FileText className="h-4 w-4" />
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">Preview is not available for this file type.</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-3">
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white dark:bg-cyan-500 dark:text-slate-900"
          >
            <Download className="h-4 w-4" />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}
