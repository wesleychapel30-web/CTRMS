import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect } from "react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastRecord = {
  id: string;
  title: string;
  message: string;
  variant: ToastVariant;
  durationMs: number;
  isClosing?: boolean;
};

type ToastMessageProps = {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
};

const variantMeta: Record<ToastVariant, { icon: typeof CheckCircle2; shell: string; iconColor: string }> = {
  success: {
    icon: CheckCircle2,
    shell: "border-emerald-200 bg-white dark:border-emerald-500/25 dark:bg-slate-950",
    iconColor: "text-emerald-600 dark:text-emerald-300",
  },
  error: {
    icon: AlertCircle,
    shell: "border-rose-200 bg-white dark:border-rose-500/25 dark:bg-slate-950",
    iconColor: "text-rose-600 dark:text-rose-300",
  },
  warning: {
    icon: AlertTriangle,
    shell: "border-amber-200 bg-white dark:border-amber-500/25 dark:bg-slate-950",
    iconColor: "text-amber-600 dark:text-amber-300",
  },
  info: {
    icon: Info,
    shell: "border-blue-200 bg-white dark:border-blue-500/25 dark:bg-slate-950",
    iconColor: "text-blue-600 dark:text-blue-300",
  },
};

export function ToastMessage({ toast, onDismiss }: ToastMessageProps) {
  useEffect(() => {
    const handle = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(handle);
  }, [onDismiss, toast.durationMs, toast.id]);

  const meta = variantMeta[toast.variant];
  const Icon = meta.icon;

  return (
    <div
      className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg shadow-slate-900/10 transition-all duration-200 ${
        toast.isClosing ? "toast-exit" : "toast-enter"
      } ${meta.shell}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${meta.iconColor}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{toast.title}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
