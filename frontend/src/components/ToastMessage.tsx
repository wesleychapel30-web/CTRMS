import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect, type CSSProperties } from "react";

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

const variantMeta: Record<ToastVariant, { icon: typeof CheckCircle2; shell: string; iconColor: string; progress: string }> = {
  success: {
    icon: CheckCircle2,
    shell: "border-emerald-200 bg-white dark:border-emerald-500/25 dark:bg-slate-950",
    iconColor: "text-emerald-600 dark:text-emerald-300",
    progress: "bg-emerald-500/80 dark:bg-emerald-300/80",
  },
  error: {
    icon: AlertCircle,
    shell: "border-rose-200 bg-white dark:border-rose-500/25 dark:bg-slate-950",
    iconColor: "text-rose-600 dark:text-rose-300",
    progress: "bg-rose-500/80 dark:bg-rose-300/80",
  },
  warning: {
    icon: AlertTriangle,
    shell: "border-amber-200 bg-white dark:border-amber-500/25 dark:bg-slate-950",
    iconColor: "text-amber-600 dark:text-amber-300",
    progress: "bg-amber-500/80 dark:bg-amber-300/80",
  },
  info: {
    icon: Info,
    shell: "border-blue-200 bg-white dark:border-blue-500/25 dark:bg-slate-950",
    iconColor: "text-blue-600 dark:text-blue-300",
    progress: "bg-blue-500/80 dark:bg-blue-300/80",
  },
};

export function ToastMessage({ toast, onDismiss }: ToastMessageProps) {
  useEffect(() => {
    const handle = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(handle);
  }, [onDismiss, toast.durationMs, toast.id]);

  const meta = variantMeta[toast.variant];
  const Icon = meta.icon;
  const progressStyle = { animationDuration: `${toast.durationMs}ms` } as CSSProperties;

  return (
    <div
      data-testid={`toast-${toast.variant}`}
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
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div
          className={`toast-progress-bar h-full origin-left rounded-full ${meta.progress}`}
          style={progressStyle}
        />
      </div>
    </div>
  );
}
